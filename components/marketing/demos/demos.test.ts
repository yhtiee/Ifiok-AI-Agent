import { describe, expect, it } from "vitest";
import { POOL_CAP, clampStudents, computePoints, formatCount, formatShare, parseCount } from "./points";
import { fmt, snap, sx, sy, tangentFrame } from "./tangent";

describe("points calculator (04 §5.7, 06 §3)", () => {
  it("reproduces the worked example: 30 + 12 = 42 points, 3% of 1,400", () => {
    const r = computePoints({ uploads: 30, explainers: 12, all: 1400 });
    expect(r.points).toBe(42);
    expect(r.share).toBeCloseTo(0.03, 10);
    expect(r.capped).toBe(false);
    expect(formatShare(r.share)).toBe("3%");
  });

  it("caps a share at 20% of the pool", () => {
    const r = computePoints({ uploads: 300, explainers: 0, all: 1000 });
    expect(r.rawShare).toBeCloseTo(0.3);
    expect(r.share).toBe(POOL_CAP);
    expect(r.capped).toBe(true);
    expect(formatShare(r.share)).toBe("20%");
  });

  it("never lets all contributors' points fall below yours", () => {
    const r = computePoints({ uploads: 10, explainers: 5, all: 3 });
    expect(r.total).toBe(15);
    expect(r.rawShare).toBe(1);
    expect(r.share).toBe(POOL_CAP);
  });

  it("handles zero and junk input", () => {
    expect(computePoints({ uploads: 0, explainers: 0, all: 0 })).toMatchObject({ points: 0, share: 0 });
    expect(computePoints({ uploads: Number.NaN, explainers: -4, all: 100 }).points).toBe(0);
    expect(clampStudents(5000)).toBe(999);
  });

  it("formats one decimal under 10% and whole numbers above", () => {
    expect(formatShare(0.045)).toBe("4.5%");
    expect(formatShare(0.1234)).toBe("12%");
    expect(parseCount("1,400")).toBe(1400);
    expect(parseCount("abc")).toBe(0);
    expect(formatCount(1400)).toBe("1,400");
  });
});

describe("hero tangent (guardrail 2: every number computed)", () => {
  it("slope is 2x and the tangent touches the curve", () => {
    const fr = tangentFrame(1.5);
    expect(fr.m).toBe(3);
    expect(fr.y).toBe(2.25);
    // The tangent line passes through the point on screen.
    const t = (fr.px - fr.tangent.x1) / (fr.tangent.x2 - fr.tangent.x1);
    expect(fr.tangent.y1 + t * (fr.tangent.y2 - fr.tangent.y1)).toBeCloseTo(fr.py, 6);
  });

  it("maps the plot box and snaps to 0.05 inside [-2.5, 2.5]", () => {
    expect([sx(-3), sx(0), sx(3)]).toEqual([0, 300, 600]);
    expect([sy(9), sy(0)]).toEqual([0, 360]);
    expect(snap(1.03)).toBeCloseTo(1.05);
    expect(snap(9)).toBe(2.5);
    expect(fmt(-0.5)).toBe("−0.50");
    expect(fmt(-1e-12)).toBe("0.00");
  });

  it("Dot leans at most 28° and changes pose with the slope", () => {
    expect(tangentFrame(1).lean).toBeCloseTo(-19.33, 1);
    expect(Math.abs(tangentFrame(2.5).lean)).toBe(28);
    expect(tangentFrame(0).pose).toBe("smile");
    expect(tangentFrame(1).pose).toBe("flat");
    expect(tangentFrame(2).pose).toBe("steep");
  });
});
