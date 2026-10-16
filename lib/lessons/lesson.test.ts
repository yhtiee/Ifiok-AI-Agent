process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";

import { describe, expect, it } from "vitest";
import { claimCheckInput, claimCheckOutput } from "@ifiok/core/ai/skills/claim-check";
import { lessonGenerateInput } from "@ifiok/core/ai/skills/lesson-generate";

describe("Lesson Generation & Quality Skills", () => {
  it("validates claimCheckInput schema correctly", () => {
    const valid = claimCheckInput.safeParse({
      blocks: [{ block_id: "s1b1", text: "The derivative of x^2 is 2x." }],
      chunks: [{ id: 101, content: "Calculus notes on power rule." }],
    });
    expect(valid.success).toBe(true);

    const outputValid = claimCheckOutput.safeParse({
      claims: [
        {
          text: "The derivative of x^2 is 2x",
          block_id: "s1b1",
          supported_by: 101,
        },
      ],
      all_grounded: true,
    });
    expect(outputValid.success).toBe(true);
  });

  it("validates lessonGenerateInput schema correctly", () => {
    const input = {
      concept: {
        id: "c1111111-1111-1111-1111-111111111111",
        title: "Slope of a Curve",
        subject: "mathematics",
        level_band: "introductory",
        prerequisites: ["Linear functions"],
        micro_skills: ["calculus.slope", "calculus.tangent"],
      },
      chunks: [{ id: 42, content: "Tangent is the limit of secant slopes." }],
      subject_profile: "stem" as const,
      outline: {
        objective: "Understand tangent lines",
        misconceptions: ["Secant and tangent are the same"],
        screens: [
          {
            id: "s1",
            title: "Secant to Tangent",
            purpose: "Introduce intuition",
            is_checkpoint: false,
            planned_block_types: ["prose", "plot"],
          },
          {
            id: "s2",
            title: "Algebraic derivation",
            purpose: "Show limit definition",
            is_checkpoint: false,
            planned_block_types: ["stepper"],
          },
          {
            id: "s3",
            title: "Concept check",
            purpose: "Check slope understanding",
            is_checkpoint: true,
            planned_block_types: ["checkpoint"],
          },
        ],
      },
    };

    const parsed = lessonGenerateInput.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("generates grounded quick explainer while lesson is generating", { timeout: 20_000 }, async () => {
    const { generateQuickExplainer } = await import("./service");
    const explainerWithDesc = generateQuickExplainer({
      title: "Matrix Inverses",
      subject: "Linear Algebra",
      description: "An n x n matrix A has an inverse if and only if its determinant is non-zero.",
    });
    expect(explainerWithDesc).toBe(
      "Matrix Inverses: An n x n matrix A has an inverse if and only if its determinant is non-zero.",
    );

    const explainerDefault = generateQuickExplainer({
      title: "Limits",
      subject: "Calculus",
      description: null,
    });
    expect(explainerDefault).toContain("Limits is a core concept in Calculus.");
  });
});
