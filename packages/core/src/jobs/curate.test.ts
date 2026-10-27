import { describe, expect, it, vi } from "vitest";
import type { CurateClassifyOutput } from "../ai/skills/contribute";
import { createCurateHandler, decide, type CurateRepo } from "./curate";
import { JobFailure, type ClaimedJob } from "./types";

const USER = "00000000-0000-4000-8000-000000000001";
const SOURCE = "00000000-0000-4000-8000-0000000000aa";
const TOPIC = "00000000-0000-4000-8000-0000000000c1";

const clean: CurateClassifyOutput = {
  readable: true,
  concept_ids: [TOPIC],
  copyrighted: false,
  personal_data: false,
  injection: false,
  reason: null,
};
const base = {
  sameHash: false,
  duplicateShare: 0,
  copyrightSignal: false,
  injectionSignal: false,
  candidates: [TOPIC],
};

describe("curation rules (F11-FR2)", () => {
  it("approves readable, on-topic material and tags only offered topics", () => {
    expect(decide({ ...base, classified: { ...clean, concept_ids: [TOPIC, "made-up"] } })).toEqual({
      status: "approved",
      concepts: [TOPIC],
    });
  });

  it("rejects duplicates and unreadable text, always with a reason", () => {
    expect(decide({ ...base, sameHash: true, classified: clean })).toMatchObject({ status: "rejected" });
    expect(decide({ ...base, duplicateShare: 0.8, classified: clean })).toMatchObject({ status: "rejected" });
    const r = decide({ ...base, classified: { ...clean, readable: false, reason: null } });
    expect(r).toMatchObject({ status: "rejected" });
    expect((r as { reason: string }).reason.length).toBeGreaterThan(10);
  });

  it("holds book-like, instruction-like, personal or unmatched material for a person", () => {
    for (const r of [
      decide({ ...base, copyrightSignal: true, classified: clean }),
      decide({ ...base, injectionSignal: true, classified: clean }),
      decide({ ...base, classified: { ...clean, personal_data: true } }),
      decide({ ...base, classified: { ...clean, copyrighted: true } }),
      decide({ ...base, candidates: [], classified: null }),
      decide({ ...base, classified: { ...clean, concept_ids: [] } }),
    ])
      expect(r.status).toBe("needs_review");
  });
});

function repo(over: Partial<CurateRepo> = {}) {
  const calls: string[] = [];
  const r: CurateRepo = {
    source: async () => ({
      ownerId: USER,
      kind: "notes",
      courseId: null,
      concept: null,
      sha256: "abc",
      sharedAt: "2026-10-27",
    }),
    pendingEmbeddings: async () => 0,
    chunks: async () => [{ page: 1, content: "Kirchhoff's current law: the currents into a node sum to zero." }],
    course: async () => null,
    courseTopics: async () => [],
    candidates: async () => [{ id: TOPIC, title: "Kirchhoff's laws", score: 0.88 }],
    sameHashInPool: async () => false,
    duplicateShare: async () => 0,
    approve: async (_id, c) => void calls.push(`approve:${c.join(",")}`),
    setReview: async (_id, s, reason) => void calls.push(`${s}:${reason}`),
    awardUnits: async (_u, n, key) => void calls.push(`units:${n}:${key}`),
    topicsWithoutSourcedLesson: async (ids) => ids,
    queueSharedLesson: async (id) => void calls.push(`lesson:${id}`),
    ...over,
  };
  return { r, calls };
}

const job = (payload: unknown, ownerId = USER, attempts = 1): ClaimedJob => ({
  queue: "curate",
  msgId: 1,
  jobId: "j",
  attempts,
  ownerId,
  payload,
});
const usage = async () => ({
  min_account_days: 0,
  min_sessions_14d: 1,
  require_email_verified: true,
  earned_units_monthly_cap: 40,
  approved_upload_units: 5,
});

describe("curate job", () => {
  it("approves, awards +5 pending Units once per upload, and rebuilds a sourceless shared lesson", async () => {
    const { r, calls } = repo();
    const gateway = { run: vi.fn(async () => ({ output: clean }) as never) };
    await createCurateHandler({ repo: r, gateway, usage }).run(job({ source_id: SOURCE, user_id: USER }));
    expect(calls).toEqual([`approve:${TOPIC}`, `units:5:upload:${SOURCE}`, `lesson:${TOPIC}`]);
  });

  it("always offers the topic the student filed it under (a Library upload)", async () => {
    const { r, calls } = repo({
      source: async () => ({
        ownerId: USER,
        kind: "lab_manual",
        courseId: null,
        concept: { id: TOPIC, title: "Kirchhoff's laws" },
        sha256: null,
        sharedAt: "x",
      }),
      candidates: async () => [],
    });
    const gateway = { run: vi.fn(async () => ({ output: clean }) as never) };
    await createCurateHandler({ repo: r, gateway, usage }).run(job({ source_id: SOURCE, user_id: USER }));
    expect(calls[0]).toBe(`approve:${TOPIC}`);
  });

  it("waits for embeddings instead of judging half the material", async () => {
    const { r } = repo({ pendingEmbeddings: async () => 3 });
    const out = await createCurateHandler({ repo: r, gateway: { run: vi.fn() }, usage }).run(
      job({ source_id: SOURCE, user_id: USER }),
    );
    expect(out.kind).toBe("defer");
  });

  it("past papers are approved for statistics but never rebuild a lesson", async () => {
    const { r, calls } = repo({
      source: async () => ({
        ownerId: USER,
        kind: "past_paper",
        courseId: null,
        concept: null,
        sha256: null,
        sharedAt: "x",
      }),
    });
    const gateway = { run: vi.fn(async () => ({ output: clean }) as never) };
    await createCurateHandler({ repo: r, gateway, usage }).run(job({ source_id: SOURCE, user_id: USER }));
    expect(calls.some((c) => c.startsWith("lesson:"))).toBe(false);
  });

  it("refuses someone else's material, unshared material and textbook pages (guardrail 7)", async () => {
    const gateway = { run: vi.fn() };
    for (const source of [
      { ownerId: "someone-else", kind: "notes", courseId: null, concept: null, sha256: null, sharedAt: "x" },
      { ownerId: USER, kind: "notes", courseId: null, concept: null, sha256: null, sharedAt: null },
      { ownerId: USER, kind: "textbook_private", courseId: null, concept: null, sha256: null, sharedAt: "x" },
    ]) {
      const { r } = repo({ source: async () => source });
      await expect(
        createCurateHandler({ repo: r, gateway, usage }).run(job({ source_id: SOURCE, user_id: USER })),
      ).rejects.toBeInstanceOf(JobFailure);
    }
    expect(gateway.run).not.toHaveBeenCalled();
  });
});
