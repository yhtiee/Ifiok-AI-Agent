import { describe, expect, it } from "vitest";
import { examPatterns, patternText, type PatternQuestion } from "./patterns";

const q = (
  paper: string,
  year: number | null,
  conceptId: string | null,
  marks: number | null,
  qtype = "calc",
): PatternQuestion => ({
  paper,
  year,
  conceptId,
  marks,
  qtype,
});

describe("examPatterns", () => {
  it("uses plain shares with fewer than 3 papers", () => {
    const p = examPatterns([
      q("p1", 2024, "sql", 30),
      q("p1", 2024, "er", 10),
      q("p2", 2023, "sql", 20),
      q("p2", 2023, "er", 40),
    ]);
    expect(p.weighted).toBe(false);
    expect(p.papers).toBe(2);
    const er = p.topics.find((t) => t.conceptId === "er")!;
    expect(er.share).toBeCloseTo(0.5);
    expect(er.asked).toBe(2);
  });

  it("weights newer papers more from 3 papers on (1.0, 0.8, 0.6)", () => {
    const p = examPatterns([q("old", 2021, "a", 10), q("mid", 2022, "b", 10), q("new", 2023, "c", 10)]);
    expect(p.weighted).toBe(true);
    const share = Object.fromEntries(p.topics.map((t) => [t.conceptId, t.share]));
    expect(share.c! / share.a!).toBeCloseTo(1 / 0.6);
    expect(p.topics[0]!.conceptId).toBe("c");
  });

  it("counts unassigned questions, treats missing marks as 1 and names a clear style", () => {
    const p = examPatterns([
      q("p1", null, "sql", null, "theory"),
      q("p1", null, "sql", null, "theory"),
      q("p1", null, null, 5),
    ]);
    expect(p.unassigned).toBe(1);
    expect(p.topics[0]).toMatchObject({ share: 2 / 7, style: "mostly explain or discuss" });
  });
});

describe("patternText", () => {
  it("speaks in counts and shares, never predictions", () => {
    const text = patternText({ asked: 6, share: 0.24, style: "mostly calculations" }, 8);
    expect(text).toBe("Asked in 6 of 8 papers · ~24% of marks · mostly calculations");
    expect(text).not.toMatch(/predict|likely to appear/i);
  });
});
