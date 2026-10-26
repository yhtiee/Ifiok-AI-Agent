import { describe, expect, it } from "vitest";
import { compareRun } from "./compare";
import { correctProcedure, fitLine, pctError, readingsFor, resultOf, roundTo, settings } from "./engine";
import { compileExperiment, publicExperiment } from "./experiment";
import { HOOKES_LAW, OHMS_LAW, PENDULUM } from "./fixtures";
import { verifyExperiment } from "./verify";

// 10 MVP-05 "Done when": g within ±3% over 50 seeds, R within ±2%, a Hooke's law lab passes the same
// checks, and an activity the engine can't measure is declined, not faked.

const within = (config: typeof PENDULUM) => {
  const c = compileExperiment(config);
  let ok = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const r = resultOf(c, correctProcedure(c, seed))!;
    if (pctError(r.value, config.analysis.accepted) <= config.analysis.tolerance_pct) ok++;
  }
  return ok;
};

describe("experiment verifier", () => {
  it.each([
    ["simple pendulum (g, ±3%)", PENDULUM],
    ["Ohm's law (R, ±2%)", OHMS_LAW],
    ["Hooke's law (k, ±3%)", HOOKES_LAW],
  ])("accepts %s, and a correct procedure lands within tolerance on 50 seeds", (_, config) => {
    const v = verifyExperiment(config);
    expect(v.ok).toBe(true);
    expect(within(config)).toBeGreaterThanOrEqual(48);
  });

  it("declines an analysis that can't recover the constant (T against L is not a straight line)", () => {
    const v = verifyExperiment({ ...PENDULUM, analysis: { ...PENDULUM.analysis, y: "t / 20" } });
    expect(v).toMatchObject({ ok: false });
  });

  it("declines an accepted value that disagrees with the engine", () => {
    const v = verifyExperiment({ ...PENDULUM, analysis: { ...PENDULUM.analysis, accepted: 10.5 } });
    expect(v).toEqual({ ok: false, reason: "The accepted value doesn't match the engine's true value." });
  });

  it("declines noise too large for a careful student to reach the accepted value", () => {
    expect(verifyExperiment({ ...PENDULUM, noise: { kind: "reaction_time", sd: 3 } }).ok).toBe(false);
  });

  it("declines code, unknown symbols and functions outside the allow-list", () => {
    expect(verifyExperiment({ ...OHMS_LAW, relation: "V / R + import('x')" }).ok).toBe(false);
    expect(verifyExperiment({ ...OHMS_LAW, relation: "V / (R * Z)" }).ok).toBe(false);
    expect(verifyExperiment({ ...OHMS_LAW, relation: "evaluate('V/R')" }).ok).toBe(false);
  });

  it("declines a configuration that isn't a measurement (a qualitative activity)", () => {
    const v = verifyExperiment({ title: "Dissection of a toad", aim: "To observe the organs", apparatus: ["Toad"] });
    expect(v.ok).toBe(false);
  });

  it("declines a quantity that doesn't change with the variable", () => {
    expect(verifyExperiment({ ...OHMS_LAW, relation: "R / 470" }).ok).toBe(false);
  });
});

describe("engine", () => {
  const c = compileExperiment(PENDULUM);

  it("is reproducible from the seed, and different seeds give different readings", () => {
    expect(readingsFor(c, 7)).toEqual(readingsFor(c, 7));
    expect(readingsFor(c, 7)).not.toEqual(readingsFor(c, 8));
  });

  it("offers the range in steps and rounds readings to the instrument's resolution", () => {
    expect(settings(PENDULUM.independent)).toEqual([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2]);
    for (const s of readingsFor(c, 3)) for (const r of s.readings) expect(roundTo(r, 0.01)).toBe(r);
  });

  it("fits a straight line", () => {
    expect(
      fitLine([
        { x: 0, y: 1 },
        { x: 1, y: 3 },
        { x: 2, y: 5 },
      ]),
    ).toMatchObject({ gradient: 2, intercept: 1, r2: 1 });
    expect(
      fitLine([
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ]),
    ).toBeNull();
  });

  it("keeps the true constant and accepted value out of what the browser gets", () => {
    const pub = JSON.stringify(publicExperiment(c));
    expect(pub).not.toContain("9.81");
    expect(pub).not.toContain("sqrt");
    expect(pub).not.toContain('"hidden"');
  });
});

describe("compareRun", () => {
  const c = compileExperiment(PENDULUM);

  it("passes a careful run and explains only random error", () => {
    const taken = correctProcedure(c, 5);
    const r = compareRun(c, taken, resultOf(c, taken)!.value);
    expect(r.withinTolerance).toBe(true);
    expect(r.notes).toHaveLength(1);
  });

  it("names too few readings, a narrow range and a calculation slip", () => {
    const taken = readingsFor(c, 5).slice(0, 3);
    const r = compareRun(c, taken, 12);
    expect(r.notes.join(" ")).toMatch(/You took 3 settings/);
    expect(r.notes.join(" ")).toMatch(/whole range/);
    expect(r.notes.join(" ")).toMatch(/check your calculation/);
  });
});

describe("lenient lists", () => {
  it("accepts apparatus written as one string, split into items", () => {
    const v = verifyExperiment({ ...OHMS_LAW, apparatus: "Resistor, ammeter (0–1 A, 0.01 A), voltmeter; wires" });
    expect(v.ok).toBe(true);
    if (v.ok)
      expect(v.compiled.config.apparatus).toEqual(["Resistor", "ammeter (0–1 A, 0.01 A)", "voltmeter", "wires"]);
  });
});
