import { describe, expect, it, vi } from "vitest";
import { GatewayError } from "../ai/gateway";
import type { LabExtractOutput } from "../ai/skills/labs";
import { HOOKES_LAW, OHMS_LAW, PENDULUM } from "../labs/fixtures";
import { createLabExtractHandler, topicKey, type LabRepo, type NewLab, type SavedLab } from "./lab-extract";
import { JobFailure, type ClaimedJob } from "./types";

const USER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const SOURCE = "00000000-0000-4000-8000-0000000000aa";
const COURSE = "00000000-0000-4000-8000-0000000000cc";

function fakeRepo(over: Partial<LabRepo> = {}) {
  const saved: NewLab[] = [];
  const links: [string, string, string | null][] = [];
  let n = 0;
  const repo: LabRepo = {
    source: async () => ({ ownerId: USER, kind: "lab_manual", courseId: COURSE, title: "PHY 107 manual" }),
    chunks: async () => [{ page: 1, content: "Experiment 3: the simple pendulum. Determine g." }],
    course: async () => ({ subject: "physics", level: 100 }),
    isMember: async () => true,
    sharedByTopic: async () => null,
    clearSource: async () => {},
    save: async (lab): Promise<SavedLab> => {
      saved.push(lab);
      return {
        id: `lab-${++n}`,
        title: lab.title,
        status: lab.status,
        reason: lab.status === "declined" ? lab.reason : null,
      };
    },
    link: async (u, l, c) => {
      links.push([u, l, c]);
    },
    ...over,
  };
  return { repo, saved, links };
}

const gatewayReturning = (output: LabExtractOutput) => ({
  run: vi.fn(async () => ({ output }) as never),
});

const job = (payload: unknown, ownerId = USER): ClaimedJob => ({
  queue: "lab_extract",
  msgId: 1,
  jobId: "j",
  attempts: 1,
  ownerId,
  payload,
});

describe("lab_extract job", () => {
  it("normalises topics so one shared lab serves every spelling", () => {
    expect(topicKey("Hooke's Law ")).toBe("hookes law");
    expect(topicKey("The simple-pendulum")).toBe("simple pendulum");
  });

  it("a requested topic that verifies becomes one shared lab, linked to the student and course", async () => {
    const { repo, saved, links } = fakeRepo();
    const gateway = gatewayReturning({ experiments: [{ ...HOOKES_LAW }], declined: [] });
    const out = await createLabExtractHandler({ repo, gateway }).run(
      job({ mode: "topic", user_id: USER, topic: "Hooke's law", course_id: COURSE }),
    );
    expect(out.kind).toBe("done");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ ownerId: null, origin: "topic", topicKey: "hookes law", status: "ready" });
    // The public configuration never carries the hidden constant.
    expect(JSON.stringify((saved[0] as { publicConfig: unknown }).publicConfig)).not.toContain('"hidden"');
    expect(links).toEqual([[USER, "lab-1", COURSE]]);
  });

  it("a topic someone already built costs no AI call", async () => {
    const { repo, saved, links } = fakeRepo({
      sharedByTopic: async () => ({ id: "existing", title: "Hooke's law", status: "ready", reason: null }),
    });
    const gateway = gatewayReturning({ experiments: [], declined: [] });
    await createLabExtractHandler({ repo, gateway }).run(
      job({ mode: "topic", user_id: USER, topic: "hookes law", course_id: null }),
    );
    expect(gateway.run).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
    expect(links).toEqual([[USER, "existing", null]]);
  });

  it("a configuration that fails the verifier is declined, never saved as runnable", async () => {
    const { repo, saved } = fakeRepo();
    const bad = { ...PENDULUM, analysis: { ...PENDULUM.analysis, y: "t / 20" } };
    const gateway = gatewayReturning({ experiments: [bad], declined: [] });
    const out = await createLabExtractHandler({ repo, gateway }).run(
      job({ mode: "topic", user_id: USER, topic: "pendulum", course_id: null }),
    );
    expect(saved).toHaveLength(0);
    expect(out).toMatchObject({ kind: "done", result: { labs: [], declined: [{ title: "pendulum" }] } });
  });

  it("a manual keeps the verified labs private and records why the others were declined", async () => {
    const { repo, saved } = fakeRepo();
    const gateway = gatewayReturning({
      experiments: [{ ...PENDULUM }, { ...OHMS_LAW, relation: "V / (R * Z)" }],
      declined: [{ title: "Dissection of a toad", reason: "Not a measurement." }],
    });
    const out = await createLabExtractHandler({ repo, gateway }).run(
      job({ mode: "manual", user_id: USER, source_id: SOURCE, course_id: COURSE }),
    );
    expect(saved.map((s) => [s.title, s.status, s.ownerId, s.origin])).toEqual([
      ["Simple pendulum", "ready", USER, "manual"],
      ["Dissection of a toad", "declined", USER, "manual"],
      ["Ohm's law", "declined", USER, "manual"],
    ]);
    expect(out).toMatchObject({ result: { labs: [{ title: "Simple pendulum" }] } });
  });

  it("refuses someone else's manual and a course the student isn't in (guardrail 7)", async () => {
    const gateway = gatewayReturning({ experiments: [], declined: [] });
    const notMine = fakeRepo({
      source: async () => ({ ownerId: OTHER, kind: "lab_manual", courseId: COURSE, title: "x" }),
    });
    await expect(
      createLabExtractHandler({ repo: notMine.repo, gateway }).run(
        job({ mode: "manual", user_id: USER, source_id: SOURCE, course_id: COURSE }),
      ),
    ).rejects.toBeInstanceOf(JobFailure);
    const notMember = fakeRepo({ isMember: async () => false });
    await expect(
      createLabExtractHandler({ repo: notMember.repo, gateway }).run(
        job({ mode: "topic", user_id: USER, topic: "Hooke's law", course_id: COURSE }),
      ),
    ).rejects.toBeInstanceOf(JobFailure);
    await expect(
      createLabExtractHandler({ repo: fakeRepo().repo, gateway }).run(
        job({ mode: "topic", user_id: USER, topic: "Hooke's law", course_id: null }, OTHER),
      ),
    ).rejects.toBeInstanceOf(JobFailure);
  });

  it("an exhausted daily allowance ends the job with the gateway's message", async () => {
    const gateway = {
      run: vi.fn(async () => {
        throw new GatewayError("quota_exhausted", "You've built 10 labs today.");
      }),
    };
    const err = await createLabExtractHandler({ repo: fakeRepo().repo, gateway })
      .run(job({ mode: "topic", user_id: USER, topic: "Boyle's law", course_id: null }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JobFailure);
    expect(err).toMatchObject({ userMessage: "You've built 10 labs today.", retryable: false });
    expect(gateway.run).toHaveBeenCalledTimes(1);
  });
});
