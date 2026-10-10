import { describe, expect, it } from "vitest";
import { lagosDay, studyStreak } from "./streak";

describe("studyStreak", () => {
  it("is 0 with no activity", () => {
    expect(studyStreak([], "2026-10-10")).toBe(0);
  });
  it("counts consecutive days ending today", () => {
    expect(studyStreak(["2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(3);
  });
  it("keeps yesterday's streak alive until today ends", () => {
    expect(studyStreak(["2026-10-08", "2026-10-09"], "2026-10-10")).toBe(2);
  });
  it("breaks after a missed day", () => {
    expect(studyStreak(["2026-10-07", "2026-10-08"], "2026-10-10")).toBe(0);
    expect(studyStreak(["2026-10-06", "2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10")).toBe(3);
  });
  it("crosses month boundaries", () => {
    expect(studyStreak(["2026-09-30", "2026-10-01"], "2026-10-01")).toBe(2);
  });
});

describe("lagosDay", () => {
  it("uses Lagos time (UTC+1)", () => {
    expect(lagosDay(new Date("2026-10-10T23:30:00Z"))).toBe("2026-10-11");
    expect(lagosDay(new Date("2026-10-10T22:30:00Z"))).toBe("2026-10-10");
  });
});
