import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { GeneratedItem } from "../ai/skills/items";
import type { LessonSpec } from "../dsl/schema";
import { checkItems, itemRows, selfConsistent, solveQuestions } from "../items/check";
import { queuePrivateLessons, type PrivateLessonRepo } from "../lessons/private";
import type { LessonRepo } from "../lessons/repo";
import { createItemsGenHandler, type ItemsRepo } from "./items-gen";
import { createLessonGenHandler } from "./lesson-gen";
import type { ClaimedJob } from "./types";

// MVP-02 with fake I/O: private lessons grounded only in the student's materials, queueing lessons
// for covered topics within the allowance, and practice items that must pass both checks.

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "content/fixtures/slope-of-a-curve.json"), "utf-8"),
) as LessonSpec;
const CONCEPT = "11111111-1111-4111-8111-111111111111";
const COURSE = "44444444-4444-4444-8444-444444444444";
const USER = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const CFG = { min_similarity: 0.8, min_chunks: 3, max_chunks: 12, items_per_topic: 10 };
const OWN_CHUNKS = [
  { id: 101, content: "My notes: the slope of a curve is the slope of the tangent.", page: 3 },
  { id: 102, content: "My notes: a secant joins two points.", page: 4 },
  { id: 103, content: "My notes: the derivative is the limit of secant slopes.", page: 5 },
];

function lessonRepo(): LessonRepo & Record<string, ReturnType<typeof vi.fn>> {
  return {
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
    publish: vi.fn(async () => "shared-lesson"),
    materializeCheckpoints: vi.fn(async () => {}),
    refundNewLesson: vi.fn(async () => {}),
  } as never;
}

function privateRepo(over: Partial<PrivateLessonRepo> = {}) {
  const repo = {
    config: vi.fn(async () => CFG),
    coverage: vi.fn(async () => new Map<string, number>()),
    sources: vi.fn(async () => OWN_CHUNKS),
    publishedConcepts: vi.fn(async () => new Set<string>()),
    publish: vi.fn(async () => "private-lesson"),
    reserve: vi.fn(async () => true),
    refund: vi.fn(async () => {}),
    enqueueLesson: vi.fn(async () => ({ jobId: "j", created: true })),
    enqueueItems: vi.fn(async () => {}),
    ...over,
  };
  return repo;
}

const job = (queue: ClaimedJob["queue"], payload: unknown, ownerId: string | null = USER): ClaimedJob => ({
  queue,
  msgId: 1,
  jobId: "j1",
  attempts: 1,
  ownerId,
  payload,
});

describe("lesson_gen, private mode", () => {
  const payload = { concept_id: CONCEPT, course_id: COURSE, user_id: USER, private: true };

  it("grounds the lesson only in the student's own chunks and publishes it as theirs", async () => {
    const repo = lessonRepo();
    const priv = privateRepo();
    const enqueueItems = vi.fn(async () => {});
    const gateway = { run: vi.fn(async () => ({ output: structuredClone(fixture), model: "m" })) };
    const out = await createLessonGenHandler({
      repo,
      gateway: gateway as never,
      privateLessons: priv,
      enqueueItems,
    }).run(job("lesson_gen", payload));
    expect(out).toMatchObject({
      kind: "done",
      result: { lesson_id: "private-lesson", status: "published", private: true },
    });
    expect(repo.sharedSources).not.toHaveBeenCalled();
    expect(priv.sources).toHaveBeenCalledWith({ userId: USER, courseId: COURSE }, CONCEPT, CFG);
    const input = (
      gateway.run.mock.calls[0] as unknown as [string, { input: { chunks: { id: number }[]; sources: string } }]
    )[1].input;
    expect(input.sources).toBe("own");
    expect(input.chunks.map((c) => c.id)).toEqual([101, 102, 103]);
    expect(repo.publish).not.toHaveBeenCalled();
    expect(priv.publish).toHaveBeenCalledWith(expect.objectContaining({ scope: { userId: USER, courseId: COURSE } }));
    expect(enqueueItems).toHaveBeenCalledWith({
      concept_id: CONCEPT,
      lesson_id: "private-lesson",
      course_id: COURSE,
      owner_id: USER,
    });
  });

  it("makes no AI call and refunds when the materials don't cover the topic", async () => {
    const priv = privateRepo({ sources: vi.fn(async () => OWN_CHUNKS.slice(0, 2)) });
    const gateway = { run: vi.fn() };
    const out = await createLessonGenHandler({
      repo: lessonRepo(),
      gateway: gateway as never,
      privateLessons: priv,
    }).run(job("lesson_gen", payload));
    expect(out).toMatchObject({ kind: "done", result: { status: "not_covered" } });
    expect(gateway.run).not.toHaveBeenCalled();
    expect(priv.refund).toHaveBeenCalledWith(USER);
  });

  it("refuses a private job owned by someone else (guardrail 7)", async () => {
    const handler = createLessonGenHandler({
      repo: lessonRepo(),
      gateway: { run: vi.fn() } as never,
      privateLessons: privateRepo(),
    });
    await expect(handler.run(job("lesson_gen", payload, OTHER))).rejects.toMatchObject({ retryable: false });
  });

  it("refunds the private allowance, not the shared one, when the lesson fails its checks", async () => {
    const repo = lessonRepo();
    const priv = privateRepo();
    const bad = structuredClone(fixture);
    bad.screens = bad.screens.slice(0, 4);
    const gateway = { run: vi.fn(async () => ({ output: structuredClone(bad), model: "m" })) };
    const out = await createLessonGenHandler({ repo, gateway: gateway as never, privateLessons: priv }).run(
      job("lesson_gen", payload),
    );
    expect(out).toMatchObject({ result: { status: "review", reason: "checks_failed" } });
    expect(priv.refund).toHaveBeenCalledWith(USER);
    expect(repo.refundNewLesson).not.toHaveBeenCalled();
    // The repair pass ran once before giving up.
    expect((gateway.run.mock.calls as unknown as [string][]).map((c) => c[0])).toContain("lesson_repair");
  });

  it("queues shared practice items after a shared lesson is published", async () => {
    const enqueueItems = vi.fn(async () => {});
    const gateway = { run: vi.fn(async () => ({ output: structuredClone(fixture), model: "m" })) };
    await createLessonGenHandler({ repo: lessonRepo(), gateway: gateway as never, enqueueItems }).run(
      job("lesson_gen", { concept_id: CONCEPT }),
    );
    expect(enqueueItems).toHaveBeenCalledWith(expect.objectContaining({ lesson_id: "shared-lesson", owner_id: null }));
  });
});

describe("queuePrivateLessons", () => {
  const scope = { userId: USER, courseId: COURSE };

  it("queues covered topics without a private lesson, one allowance each", async () => {
    const priv = privateRepo({
      coverage: vi.fn(
        async () =>
          new Map([
            ["a", 5],
            ["b", 2],
            ["c", 4],
          ]),
      ),
      publishedConcepts: vi.fn(async () => new Set(["c"])),
    });
    const r = await queuePrivateLessons(priv, scope, null);
    expect(r.queued).toEqual(["a"]);
    expect(priv.reserve).toHaveBeenCalledOnce();
  });

  it("stops at the daily allowance and says which topics wait", async () => {
    const priv = privateRepo({
      coverage: vi.fn(
        async () =>
          new Map([
            ["a", 5],
            ["b", 5],
          ]),
      ),
      reserve: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    });
    const r = await queuePrivateLessons(priv, scope, null);
    expect(r).toEqual({ queued: ["a"], skipped: [{ conceptId: "b", reason: "quota" }] });
  });

  it("gives the allowance back when the lesson was already queued", async () => {
    const priv = privateRepo({
      coverage: vi.fn(async () => new Map([["a", 5]])),
      enqueueLesson: vi.fn(async () => ({ jobId: "j", created: false })),
    });
    await queuePrivateLessons(priv, scope, null);
    expect(priv.refund).toHaveBeenCalledWith(USER);
  });
});

const numeric = (over: Partial<Extract<GeneratedItem, { type: "numeric" }>> = {}): GeneratedItem => ({
  type: "numeric",
  difficulty: 2,
  stem_md: "A ball is thrown at 20 m/s at 30 degrees. Find its range (g = 10).",
  answer_expr: "20^2 * sin(2 * pi / 6) / 10",
  stated: 34.64,
  unit: "m",
  why: "R = u^2 sin 2θ / g",
  micro_skills: [],
  source_refs: [],
  ...over,
});
const mcq = (over: Partial<Extract<GeneratedItem, { type: "mcq" }>> = {}): GeneratedItem => ({
  type: "mcq",
  difficulty: 1,
  stem_md: "At the top of its path, a projectile's vertical velocity is",
  options: [
    { id: "a", md: "zero", why: "Vertical velocity changes sign at the top." },
    { id: "b", md: "maximum", why: "No: it is smallest there." },
    { id: "c", md: "equal to g", why: "g is an acceleration." },
  ],
  correct: "a",
  micro_skills: [],
  source_refs: [],
  ...over,
});

describe("practice item checks", () => {
  it("drops a numeric item whose stated answer disagrees with answer_expr", () => {
    expect(selfConsistent(numeric())).toBe(true);
    expect(selfConsistent(numeric({ stated: 40 }))).toBe(false);
    expect(selfConsistent(numeric({ answer_expr: "x * 2" }))).toBe(false);
    const { accepted, dropped } = checkItems([numeric({ stated: 40 })], [{ index: 0, answer_expr: "40" }]);
    expect(accepted).toEqual([]);
    expect(dropped).toEqual([{ index: 0, reason: "self_consistency" }]);
  });

  it("keeps items only when the independent solve agrees", () => {
    const items = [numeric(), mcq(), numeric({ stem_md: "Another" }), mcq({ stem_md: "Another mcq" })];
    const { accepted, dropped } = checkItems(items, [
      { index: 0, answer_expr: "400 * sin(pi / 3) / 10" },
      { index: 1, option_id: "a" },
      { index: 2, answer_expr: "30" },
      { index: 3, option_id: "b" },
    ]);
    expect(accepted.map((i) => i.stem_md)).toEqual([items[0]!.stem_md, items[1]!.stem_md]);
    expect(dropped.map((d) => d.reason)).toEqual(["solve_disagrees", "solve_disagrees"]);
  });

  it("drops duplicates and unsolved items, and never shows the solver the answers", () => {
    const { accepted, dropped } = checkItems(
      [mcq(), mcq(), numeric()],
      [
        { index: 0, option_id: "a" },
        { index: 1, option_id: "a" },
      ],
    );
    expect(accepted).toHaveLength(1);
    expect(dropped.map((d) => d.reason)).toEqual(["duplicate", "unsolved"]);
    const shown = JSON.stringify(solveQuestions([mcq(), numeric()]));
    expect(shown).not.toContain("correct");
    expect(shown).not.toContain("answer_expr");
    expect(shown).not.toContain("34.64");
  });

  it("saves checked items as published rows owned by the student", () => {
    const [row] = itemRows([numeric()], { conceptId: CONCEPT, ownerId: USER, courseId: COURSE });
    expect(row).toMatchObject({ owner_id: USER, origin: "generated", status: "published", type: "numeric" });
  });
});

describe("items_gen handler", () => {
  const payload = {
    concept_id: CONCEPT,
    lesson_id: "55555555-5555-4555-8555-555555555555",
    course_id: COURSE,
    owner_id: USER,
  };
  const itemsRepo = (over: Partial<ItemsRepo> = {}) => ({
    loadLesson: vi.fn(async () => ({ conceptId: CONCEPT, ownerId: USER, status: "published", spec: fixture })),
    countGenerated: vi.fn(async () => 0),
    insert: vi.fn(async () => {}),
    ...over,
  });

  it("saves only items that pass both checks, grounded in the student's chunks", async () => {
    const items = itemsRepo();
    const priv = privateRepo();
    const gateway = {
      run: vi.fn(async (skill: string) =>
        skill === "items_generate"
          ? { output: { items: [numeric(), numeric({ stem_md: "Wrong one", stated: 99 }), mcq()] }, model: "m" }
          : {
              output: {
                answers: [
                  { index: 0, answer_expr: "34.64" },
                  { index: 1, answer_expr: "99" },
                  { index: 2, option_id: "a" },
                ],
              },
              model: "m",
            },
      ),
    };
    const out = await createItemsGenHandler({
      items,
      lessons: lessonRepo(),
      privateLessons: priv,
      gateway: gateway as never,
    }).run(job("items_gen", payload));
    expect(out).toMatchObject({ kind: "done", result: { generated: 3, published: 2, dropped: ["self_consistency"] } });
    const rows = (
      (items.insert as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [{ owner_id: string }[]]
    )[0];
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.owner_id === USER)).toBe(true);
    expect(priv.sources).toHaveBeenCalledWith({ userId: USER, courseId: COURSE }, CONCEPT, CFG);
  });

  it("refuses private items for someone else, and skips a topic that already has enough", async () => {
    const handler = createItemsGenHandler({
      items: itemsRepo({ countGenerated: vi.fn(async () => 10) }),
      lessons: lessonRepo(),
      privateLessons: privateRepo(),
      gateway: { run: vi.fn() } as never,
    });
    await expect(handler.run(job("items_gen", payload, OTHER))).rejects.toMatchObject({ retryable: false });
    expect(await handler.run(job("items_gen", payload))).toMatchObject({ result: { skipped: "enough_items" } });
  });
});
