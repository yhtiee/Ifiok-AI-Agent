import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/viewer";

// MVP-03 "Done when": a forged correct answer is stored as wrong; replaying attempt UUIDs records
// each once; another student's private item is refused. Fake database, real marking.

const state = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  enrollments: [] as Record<string, unknown>[],
  seen: new Set<string>(),
  recorded: [] as { p_id: string; p_correct: boolean; p_item: string }[],
}));

function fakeAdmin() {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push([col, [val]]);
          return builder;
        },
        in: (col: string, vals: unknown[]) => {
          filters.push([col, vals]);
          return builder;
        },
        then(ok: (r: { data: unknown[] }) => unknown) {
          const rows =
            table === "items" || table === "enrollments"
              ? (table === "items" ? state.items : state.enrollments).filter((i) =>
                  filters.every(([c, v]) => (v as unknown[]).includes(i[c])),
                )
              : [];
          return Promise.resolve({ data: rows }).then(ok);
        },
      };
      return builder;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "record_attempt") {
        const inserted = !state.seen.has(args.p_id as string);
        if (inserted) {
          state.seen.add(args.p_id as string);
          state.recorded.push(args as never);
        }
        return Promise.resolve({ data: [{ inserted, concept_id: "c1", m: 0.18, level: "not_started" }], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeAdmin() }));
vi.mock("@/lib/ai", () => ({ getGateway: () => ({ run: vi.fn() }) }));

const { syncBody, syncEvidence, skillTitle } = await import("./sync");

const ME = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000b1";
const viewer = { userId: ME } as Viewer;
const MCQ = "60000000-0000-4000-8000-000000000001";
const PRIVATE_OTHER = "60000000-0000-4000-8000-000000000002";
const LESSON = "40000000-0000-4000-8000-000000000001";

const mcq = (id: string, owner: string | null) => ({
  id,
  type: "mcq",
  stem: {
    prompt: "Q",
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
  },
  answer: { correct_option_id: "a", feedback: { a: "yes", b: "no" } },
  verification: {},
  concept_id: "c1",
  owner_id: owner,
  status: "published",
  lesson_id: null,
  block_id: null,
  origin: "generated",
  course_id: null,
});

beforeEach(() => {
  state.seen.clear();
  state.recorded = [];
  state.enrollments = [];
  state.items = [
    mcq(MCQ, null),
    mcq(PRIVATE_OTHER, OTHER),
    { ...mcq("60000000-0000-4000-8000-000000000003", null), lesson_id: LESSON, block_id: "s2b1" },
  ];
});

const attempt = (id: string, extra: Record<string, unknown>) => ({ id, ...extra });

describe("syncEvidence", () => {
  it("stores a forged 'correct' as wrong: only the server's marking counts", async () => {
    const body = syncBody.parse({
      attempts: [
        {
          ...attempt("a0000000-0000-4000-8000-000000000001", { item_id: MCQ }),
          correct: true,
          response: { option_id: "b" },
        },
      ],
    });
    const { result } = await syncEvidence(viewer, body);
    expect(result.attempts[0]).toMatchObject({ status: "recorded", correct: false, why: "no", answer: "A" });
    expect(state.recorded[0]!.p_correct).toBe(false);
  });

  it("records a replayed attempt UUID once", async () => {
    const body = syncBody.parse({
      attempts: [attempt("a0000000-0000-4000-8000-000000000002", { item_id: MCQ, response: { option_id: "a" } })],
    });
    await syncEvidence(viewer, body);
    const again = await syncEvidence(viewer, body);
    expect(again.result.attempts[0]).toMatchObject({ status: "duplicate", correct: true });
    expect(state.recorded).toHaveLength(1);
  });

  it("refuses another student's private item, and resolves a lesson checkpoint by block", async () => {
    const body = syncBody.parse({
      attempts: [
        attempt("a0000000-0000-4000-8000-000000000003", { item_id: PRIVATE_OTHER, response: { option_id: "a" } }),
        attempt("a0000000-0000-4000-8000-000000000004", {
          lesson_id: LESSON,
          block_id: "s2b1",
          response: { option_id: "a" },
        }),
      ],
    });
    const { result } = await syncEvidence(viewer, body);
    expect(result.attempts.map((r) => r.status)).toEqual(["not_found", "recorded"]);
  });

  it("lets only the course's members answer its past-paper questions, self-marked", async () => {
    const PAST = "60000000-0000-4000-8000-000000000009";
    const COURSE = "20000000-0000-4000-8000-000000000001";
    state.items.push({
      ...mcq(PAST, null),
      type: "short_text",
      origin: "past_paper",
      course_id: COURSE,
    });
    const body = syncBody.parse({
      attempts: [attempt("a0000000-0000-4000-8000-000000000008", { item_id: PAST, response: { self: "partly" } })],
    });
    expect((await syncEvidence(viewer, body)).result.attempts[0]!.status).toBe("not_found");
    state.enrollments.push({ user_id: ME, course_id: COURSE });
    const { result } = await syncEvidence(viewer, body);
    expect(result.attempts[0]).toMatchObject({ status: "recorded", correct: true });
    expect((state.recorded.at(-1) as unknown as { p_weight_factor: number }).p_weight_factor).toBe(0.5);
  });

  it("queues wrong answers (not right ones) for an explanation", async () => {
    const body = syncBody.parse({
      attempts: [
        attempt("a0000000-0000-4000-8000-000000000005", { item_id: MCQ, response: { option_id: "b" } }),
        attempt("a0000000-0000-4000-8000-000000000006", { item_id: MCQ, response: { option_id: "a" } }),
      ],
    });
    const { explain } = await syncEvidence(viewer, body);
    expect(explain.map((e) => e.attemptId)).toEqual(["a0000000-0000-4000-8000-000000000005"]);
  });

  it("rejects a malformed batch before anything is recorded", () => {
    expect(
      syncBody.safeParse({ attempts: [{ id: "not-a-uuid", item_id: MCQ, response: { option_id: "a" } }] }).success,
    ).toBe(false);
    expect(
      syncBody.safeParse({ attempts: [{ id: "a0000000-0000-4000-8000-000000000007", response: { option_id: "a" } }] })
        .success,
    ).toBe(false);
  });
});

describe("skillTitle", () => {
  it("turns a micro-skill code into words", () => {
    expect(skillTitle("sql.window_functions")).toBe("Window functions");
    expect(skillTitle("components")).toBe("Components");
  });
});
