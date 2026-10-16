import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GatewayError } from "../ai/gateway";
import type { Json } from "../db/types";
import type { LessonSpec } from "../dsl/schema";
import type { LessonRepo } from "../lessons/repo";
import { createLessonGenHandler, secondsUntilLagosMidnight } from "./lesson-gen";
import { noopHandler } from "./noop";
import { runWorker } from "./runner";
import { MAX_ATTEMPTS, type ClaimedJob, type JobHandler, type QueueName, type WorkerQueue } from "./types";

// P0-11 runner semantics with an in-memory queue, and the lesson_gen handler with fake I/O.

type Msg = { job: ClaimedJob; visibleAt: number; done: boolean };

/** An in-memory stand-in for pgmq + jobs, with a controllable clock. */
function memoryQueue(clock: { t: number }) {
  const msgs: Msg[] = [];
  const jobs = new Map<string, { status: string; attempts: number; error?: string; result?: Json }>();
  let nextMsg = 1;
  const queue: WorkerQueue = {
    async read(q, vt, qty) {
      const out: ClaimedJob[] = [];
      for (const m of msgs) {
        if (out.length >= qty) break;
        if (m.job.queue !== q || m.done || m.visibleAt > clock.t) continue;
        const row = jobs.get(m.job.jobId)!;
        row.status = "running";
        row.attempts++;
        m.visibleAt = clock.t + vt * 1000;
        out.push({ ...m.job, attempts: row.attempts });
      }
      return out;
    },
    async complete(job, result) {
      Object.assign(jobs.get(job.jobId)!, { status: "done", result });
      msgs.find((m) => m.job.msgId === job.msgId)!.done = true;
    },
    async fail(job, error, final, retryAfterS) {
      Object.assign(jobs.get(job.jobId)!, { status: final ? "failed" : "queued", error });
      const m = msgs.find((x) => x.job.msgId === job.msgId)!;
      if (final) m.done = true;
      else m.visibleAt = clock.t + retryAfterS * 1000;
    },
    async defer(job, seconds, result) {
      const row = jobs.get(job.jobId)!;
      Object.assign(row, { status: "queued", result, attempts: row.attempts - 1 });
      msgs.find((x) => x.job.msgId === job.msgId)!.visibleAt = clock.t + seconds * 1000;
    },
  };
  const enqueue = (q: QueueName, payload: unknown, ownerId: string | null = null) => {
    const jobId = `job-${nextMsg}`;
    jobs.set(jobId, { status: "queued", attempts: 0 });
    msgs.push({ job: { queue: q, msgId: nextMsg++, jobId, attempts: 0, ownerId, payload }, visibleAt: 0, done: false });
    return jobId;
  };
  return { queue, jobs, enqueue };
}

describe("runWorker", () => {
  it("runs a job to done", async () => {
    const clock = { t: 0 };
    const m = memoryQueue(clock);
    const id = m.enqueue("noop", {});
    const r = await runWorker({ queue: m.queue, handlers: { noop: noopHandler }, now: () => clock.t });
    expect(r.processed).toBe(1);
    expect(m.jobs.get(id)).toMatchObject({ status: "done", attempts: 1 });
  });

  it("retries a failing handler and ends it failed after 3 attempts, then gives up once", async () => {
    const clock = { t: 0 };
    const m = memoryQueue(clock);
    const id = m.enqueue("noop", { fail: true });
    const giveUp = vi.fn(async () => {});
    const handler: JobHandler = { ...noopHandler, giveUp };
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await runWorker({ queue: m.queue, handlers: { noop: handler }, now: () => clock.t });
      expect(m.jobs.get(id)!.status).toBe(i < MAX_ATTEMPTS - 1 ? "queued" : "failed");
      clock.t += 60_000; // past the retry backoff (the sweeper wakes the worker every minute)
    }
    expect(m.jobs.get(id)).toMatchObject({ status: "failed", attempts: 3, error: "This test job always fails." });
    expect(giveUp).toHaveBeenCalledOnce();
    // Nothing left to run.
    expect((await runWorker({ queue: m.queue, handlers: { noop: handler }, now: () => clock.t })).processed).toBe(0);
  });

  it("picks up a job whose wake-up trigger was dropped (the sweeper's run finds it)", async () => {
    const clock = { t: 0 };
    const m = memoryQueue(clock);
    const id = m.enqueue("noop", {}); // no trigger call at all
    await runWorker({ queue: m.queue, handlers: { noop: noopHandler }, now: () => clock.t });
    expect(m.jobs.get(id)!.status).toBe("done");
  });

  it("gets a crashed run back after the visibility timeout", async () => {
    const clock = { t: 0 };
    const m = memoryQueue(clock);
    const id = m.enqueue("noop", {});
    // A run that claims the job and dies: no complete, no fail.
    await m.queue.read("noop", 180, 1);
    expect((await runWorker({ queue: m.queue, handlers: { noop: noopHandler }, now: () => clock.t })).processed).toBe(
      0,
    );
    clock.t += 181_000;
    await runWorker({ queue: m.queue, handlers: { noop: noopHandler }, now: () => clock.t });
    expect(m.jobs.get(id)).toMatchObject({ status: "done", attempts: 2 });
  });

  it("fails a message that keeps crashing the runtime without running it again", async () => {
    const clock = { t: 0 };
    const m = memoryQueue(clock);
    const id = m.enqueue("noop", {});
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await m.queue.read("noop", 0, 1); // three crashed claims
    }
    const run = vi.fn(noopHandler.run);
    await runWorker({ queue: m.queue, handlers: { noop: { run } }, now: () => clock.t });
    expect(run).not.toHaveBeenCalled();
    expect(m.jobs.get(id)!.status).toBe("failed");
  });

  it("takes one heavy job per invocation and skips heavy work when the deadline is near", async () => {
    const clock = { t: 0 };
    const m = memoryQueue(clock);
    m.enqueue("lesson_gen", {});
    m.enqueue("lesson_gen", {});
    const run = vi.fn(async () => ({ kind: "done" as const, result: {} }));
    expect((await runWorker({ queue: m.queue, handlers: { lesson_gen: { run } }, now: () => clock.t })).processed).toBe(
      1,
    );
    expect(
      (await runWorker({ queue: m.queue, handlers: { lesson_gen: { run } }, now: () => clock.t, deadlineMs: 50_000 }))
        .processed,
    ).toBe(0);
  });

  it("drains light queues in batches", async () => {
    const clock = { t: 0 };
    const m = memoryQueue(clock);
    for (let i = 0; i < 7; i++) m.enqueue("noop", {});
    expect((await runWorker({ queue: m.queue, handlers: { noop: noopHandler }, now: () => clock.t })).processed).toBe(
      7,
    );
  });

  it("parks a deferred job without counting the attempt", async () => {
    const clock = { t: 0 };
    const m = memoryQueue(clock);
    const id = m.enqueue("noop", {});
    const handler: JobHandler = { run: async () => ({ kind: "defer", seconds: 3600, result: { waiting: "x" } }) };
    await runWorker({ queue: m.queue, handlers: { noop: handler }, now: () => clock.t });
    expect(m.jobs.get(id)).toMatchObject({ status: "queued", attempts: 0 });
    expect((await runWorker({ queue: m.queue, handlers: { noop: handler }, now: () => clock.t })).processed).toBe(0);
  });
});

// ---- lesson_gen ----

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "content/fixtures/slope-of-a-curve.json"), "utf-8"),
) as LessonSpec;
const CONCEPT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

function fakeRepo(overrides: Partial<LessonRepo> = {}) {
  const repo = {
    loadConcept: vi.fn(async () => ({
      id: CONCEPT,
      title: "Slope of a curve",
      description: null,
      subject: "mathematics",
      level_band: "introductory",
      micro_skills: [],
    })),
    sharedSources: vi.fn(async () => []),
    isSensitive: vi.fn(async () => false),
    courseContext: vi.fn(async () => null),
    publish: vi.fn(async () => "lesson-1"),
    materializeCheckpoints: vi.fn(async () => {}),
    refundNewLesson: vi.fn(async () => {}),
    ...overrides,
  };
  return repo;
}

const job = (payload: unknown, ownerId: string | null = USER): ClaimedJob => ({
  queue: "lesson_gen",
  msgId: 1,
  jobId: "j1",
  attempts: 1,
  ownerId,
  payload,
});

describe("lesson_gen handler", () => {
  it("publishes a lesson that passes and materialises its checkpoints", async () => {
    const repo = fakeRepo();
    const gateway = { run: vi.fn(async () => ({ output: structuredClone(fixture), model: "m" })) };
    const out = await createLessonGenHandler({ repo, gateway: gateway as never }).run(
      job({ concept_id: CONCEPT, user_id: USER }),
    );
    expect(out).toMatchObject({ kind: "done", result: { lesson_id: "lesson-1", status: "published" } });
    expect(repo.publish).toHaveBeenCalledWith(expect.objectContaining({ status: "published", requestedBy: USER }));
    expect(repo.materializeCheckpoints).toHaveBeenCalledOnce();
    expect(repo.refundNewLesson).not.toHaveBeenCalled();
  });

  it("uses the backup provider (attempt 2) when the primary fails", async () => {
    const gateway = {
      run: vi
        .fn()
        .mockRejectedValueOnce(new GatewayError("provider_failed", "x"))
        .mockResolvedValueOnce({ output: structuredClone(fixture), model: "backup" }),
    };
    await createLessonGenHandler({ repo: fakeRepo(), gateway: gateway as never }).run(job({ concept_id: CONCEPT }));
    expect(gateway.run.mock.calls.map((c) => (c[1] as { attempt: number }).attempt)).toEqual([1, 2]);
  });

  it("refunds and saves for review when the lesson fails a check", async () => {
    const repo = fakeRepo();
    const bad = structuredClone(fixture);
    bad.screens = bad.screens.slice(0, 4);
    const gateway = { run: vi.fn(async () => ({ output: bad, model: "m" })) };
    const out = await createLessonGenHandler({ repo, gateway: gateway as never }).run(
      job({ concept_id: CONCEPT, user_id: USER }),
    );
    expect(out).toMatchObject({ kind: "done", result: { status: "review", reason: "checks_failed" } });
    expect(repo.materializeCheckpoints).not.toHaveBeenCalled();
    expect(repo.refundNewLesson).toHaveBeenCalledWith(USER);
  });

  it("parks the job until Lagos midnight when the library budget is used up", async () => {
    const gateway = { run: vi.fn(async () => Promise.reject(new GatewayError("library_budget", "x"))) };
    const now = new Date("2026-10-16T21:30:00Z"); // 22:30 in Lagos
    const out = await createLessonGenHandler({ repo: fakeRepo(), gateway: gateway as never, now: () => now }).run(
      job({ concept_id: CONCEPT }),
    );
    expect(out).toEqual({ kind: "defer", seconds: 5400, result: { waiting: "library_budget", day: "2026-10-16" } });
    expect(gateway.run).toHaveBeenCalledOnce(); // no backup attempt on a budget stop
  });

  it("rejects a payload whose user isn't the job owner (guardrail 7), without retrying", async () => {
    const handler = createLessonGenHandler({ repo: fakeRepo(), gateway: { run: vi.fn() } as never });
    await expect(
      handler.run(job({ concept_id: CONCEPT, user_id: USER }, "33333333-3333-4333-8333-333333333333")),
    ).rejects.toMatchObject({
      name: "JobFailure",
      retryable: false,
    });
  });

  it("throws a retryable failure when the model keeps failing, and refunds when it gives up", async () => {
    const repo = fakeRepo();
    const gateway = { run: vi.fn(async () => Promise.reject(new GatewayError("provider_failed", "x"))) };
    const handler = createLessonGenHandler({ repo, gateway: gateway as never });
    await expect(handler.run(job({ concept_id: CONCEPT, user_id: USER }))).rejects.toMatchObject({ retryable: true });
    await handler.giveUp!(job({ concept_id: CONCEPT, user_id: USER }));
    expect(repo.refundNewLesson).toHaveBeenCalledWith(USER);
  });

  it("only asks for course context when the job names a course and a user", async () => {
    const repo = fakeRepo();
    const gateway = { run: vi.fn(async () => ({ output: structuredClone(fixture), model: "m" })) };
    const handler = createLessonGenHandler({ repo, gateway: gateway as never });
    await handler.run(job({ concept_id: CONCEPT }, null));
    expect(repo.courseContext).not.toHaveBeenCalled();
    const course = "44444444-4444-4444-8444-444444444444";
    await handler.run(job({ concept_id: CONCEPT, course_id: course, user_id: USER }));
    expect(repo.courseContext).toHaveBeenCalledWith(course, USER, CONCEPT);
  });
});

describe("secondsUntilLagosMidnight", () => {
  it("counts to midnight WAT", () => {
    expect(secondsUntilLagosMidnight(new Date("2026-10-16T22:59:00Z"))).toBe(60);
    expect(secondsUntilLagosMidnight(new Date("2026-10-16T23:00:00Z"))).toBe(86_400);
  });
});
