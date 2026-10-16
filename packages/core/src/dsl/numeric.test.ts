import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyLesson } from "../verify/lesson";
import { decimalsOf, numericMatches } from "./numeric";

describe("numeric tolerance", () => {
  it("counts decimal places as written", () => {
    expect(decimalsOf(0.498)).toBe(3);
    expect(decimalsOf(2.44)).toBe(2);
    expect(decimalsOf(6)).toBe(0);
    expect(decimalsOf(1.5e-5)).toBe(6);
  });

  it("accepts values rounded to their written precision (the failing live cases)", () => {
    expect(numericMatches(0.4976796756420407, 0.498)).toBe(true);
    expect(numericMatches(2.4395604395604398, 2.44)).toBe(true);
  });

  it("still rejects real mismatches", () => {
    expect(numericMatches(0.7938381661982452, 0.42)).toBe(false);
    expect(numericMatches(5.6, 6)).toBe(false); // rounding allowance is capped at 0.5%
    expect(numericMatches(0.5, 0.498)).toBe(false);
    expect(numericMatches(Number.NaN, 1)).toBe(false);
  });

  it("is exact for exact values and honours an explicit tolerance", () => {
    expect(numericMatches(6, 6)).toBe(true);
    expect(numericMatches(5.98, 6)).toBe(true); // 0.33%, within rounding of "6"
    expect(numericMatches(9.5, 10, { abs: 0.5 })).toBe(true);
    expect(numericMatches(9, 10, { rel: 0.1 })).toBe(true);
  });
});

describe("expression syntax normalisation in verifyLesson", () => {
  it("reads ** as ^ in plots and numeric answers", () => {
    const spec = JSON.parse(readFileSync(join(process.cwd(), "content/fixtures/slope-of-a-curve.json"), "utf-8"));
    spec.screens[0].blocks[1] = {
      id: "s1b2",
      type: "plot",
      x: [1, 5],
      functions: [{ expr: "x**2", role: "quantity" }],
    };
    const cp = spec.screens
      .flatMap((s: { blocks: { type: string; item?: { type: string } }[] }) => s.blocks)
      .find((b: { type: string; item?: { type: string } }) => b.type === "checkpoint" && b.item?.type === "numeric");
    cp.item.answer_expr = "2**3";
    cp.item.stated = 8;
    const r = verifyLesson(spec);
    expect(r.errors).toEqual([]);
    expect(JSON.stringify(r.verifiedSpec)).not.toContain("**");
  });
});
