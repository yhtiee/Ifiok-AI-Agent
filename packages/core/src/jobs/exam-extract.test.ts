import { describe, expect, it, vi } from "vitest";
import { createExamExtractHandler, mergeChunks, type ExamRepo } from "./exam-extract";
import type { ClaimedJob } from "./types";

// MVP-04: past-paper text rebuilt from chunks, questions tagged only to the course's own topics
// (or left Unassigned), and only for the paper's owner. Fake I/O.

const USER = "22222222-2222-4222-8222-222222222222";
const COURSE = "44444444-4444-4444-8444-444444444444";
const SOURCE = "55555555-5555-4555-8555-555555555555";
const SQL = "66666666-6666-4666-8666-666666666666";

const repo = (over: Partial<ExamRepo> = {}): ExamRepo => ({
  source: vi.fn(async () => ({ ownerId: USER, courseId: COURSE, kind: "past_paper" })),
  chunks: vi.fn(async () => [
    { id: 1, page: 1, content: "1a Define a primary key. (5 marks) 1b Write a join. (10 marks)" },
  ]),
  course: vi.fn(async () => ({ code: "CPE 300", title: "Databases" })),
  topics: vi.fn(async () => [{ conceptId: SQL, title: "SQL" }]),
  ...over,
});

const job = (ownerId: string = USER): ClaimedJob => ({
  queue: "exam_extract",
  msgId: 1,
  jobId: "j",
  attempts: 1,
  ownerId,
  payload: { source_id: SOURCE, course_id: COURSE, user_id: USER },
});

const extracted = {
  year: 2024,
  instructions: "Answer any four questions",
  questions: [
    { number: "1", sub: "a", text: "Define a primary key.", marks: 5, qtype: "definition", confidence: 0.9 },
    { number: "1", sub: "b", text: "Write a join.", marks: 10, qtype: "calc", confidence: 0.8 },
  ],
};

describe("mergeChunks", () => {
  it("drops the overlap between chunks of one page and separates pages", () => {
    const text = mergeChunks([
      { page: 1, content: "one two three four five" },
      { page: 1, content: "four five six seven" },
      { page: 2, content: "eight nine" },
    ]);
    expect(text).toBe("one two three four five six seven\n\n[page 2]\n eight nine");
  });
});

describe("exam_extract handler", () => {
  it("returns a draft for review, tagging only sure matches to the course's own topics", async () => {
    const gateway = {
      run: vi.fn(async (skill: string) =>
        skill === "exam_extract"
          ? { output: extracted }
          : {
              output: {
                results: [
                  { index: 0, topic_id: SQL, confidence: 0.9 },
                  { index: 1, topic_id: SQL, confidence: 0.4 },
                ],
              },
            },
      ),
    };
    const out = await createExamExtractHandler({ repo: repo(), gateway: gateway as never }).run(job());
    expect(out.kind).toBe("done");
    const draft = (
      out as unknown as { result: { draft: { year: number; questions: { concept_id: string | null }[] } } }
    ).result.draft;
    expect(draft.year).toBe(2024);
    expect(draft.questions.map((q) => q.concept_id)).toEqual([SQL, null]);
  });

  it("ignores a topic id that isn't in the course outline", async () => {
    const gateway = {
      run: vi.fn(async (skill: string) =>
        skill === "exam_extract"
          ? { output: extracted }
          : { output: { results: [{ index: 0, topic_id: "someone-elses-concept", confidence: 0.99 }] } },
      ),
    };
    const out = await createExamExtractHandler({ repo: repo(), gateway: gateway as never }).run(job());
    const draft = (out as unknown as { result: { draft: { questions: { concept_id: string | null }[] } } }).result
      .draft;
    expect(draft.questions[0]!.concept_id).toBeNull();
  });

  it("refuses another student's paper, or a source that isn't a past paper of this course (guardrail 7)", async () => {
    const handler = (r: ExamRepo) => createExamExtractHandler({ repo: r, gateway: { run: vi.fn() } as never });
    await expect(handler(repo()).run(job("someone-else"))).rejects.toMatchObject({ retryable: false });
    await expect(
      handler(repo({ source: vi.fn(async () => ({ ownerId: USER, courseId: COURSE, kind: "notes" })) })).run(job()),
    ).rejects.toMatchObject({ retryable: false });
  });
});
