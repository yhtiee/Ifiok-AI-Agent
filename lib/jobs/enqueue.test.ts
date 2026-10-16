import { describe, expect, it } from "vitest";
import { checkUserQueue } from "./enqueue";

describe("checkUserQueue (/api/jobs/enqueue allow-list)", () => {
  it("never lets a user enqueue to system queues", () => {
    for (const q of ["payouts", "curate", "notify", "embed", "items_gen", "noop", "mark_verify", "__proto__"]) {
      expect(checkUserQueue(q)).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("answers 'not available yet' for user queues whose ticket hasn't landed", () => {
    for (const q of ["mark_transcribe", "ocr", "lesson_gen"]) {
      expect(checkUserQueue(q)).toMatchObject({ ok: false, status: 422, code: "queue_not_open" });
    }
  });
});
