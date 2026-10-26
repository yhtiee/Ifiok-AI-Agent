import { describe, expect, it } from "vitest";
import type { LessonSpec } from "../dsl/schema";
import { checkpointItems } from "./repo";

// 12 §4 Q51: order/match checkpoint items wait for human review only when the curation switch is on.

const spec = {
  screens: [
    {
      id: "s1",
      blocks: [
        {
          id: "s1b1",
          type: "checkpoint",
          item: {
            type: "order",
            stem_md: "Put the stages in order",
            steps: ["Offer", "Acceptance"],
            why: "An offer comes first.",
          },
        },
        {
          id: "s1b2",
          type: "checkpoint",
          item: {
            type: "mcq",
            stem_md: "Q",
            options: [
              { id: "a", md: "A", why: "w" },
              { id: "b", md: "B", why: "w" },
            ],
            correct: "a",
          },
        },
      ],
    },
  ],
} as unknown as LessonSpec;

describe("checkpointItems", () => {
  it("publishes order/match checkpoints with the lesson while curation is off (until Grow)", () => {
    expect(checkpointItems("l1", "c1", spec).map((r) => `${r.type}:${r.status}`)).toEqual([
      "order:published",
      "mcq:published",
    ]);
  });

  it("holds order/match checkpoints for review when the switch is on", () => {
    expect(checkpointItems("l1", "c1", spec, true).map((r) => `${r.type}:${r.status}`)).toEqual([
      "order:review",
      "mcq:published",
    ]);
  });
});
