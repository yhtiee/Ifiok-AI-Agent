import { describe, expect, it } from "vitest";
import { canOpenStep, requiredStep, safeNextPath } from "./onboarding";

const base = { is_adult: false, onboarded_at: null as string | null };

describe("requiredStep", () => {
  it("starts with the date of birth, then consent, then the study profile", () => {
    expect(requiredStep({ profile: base, consented: false })).toBe("birth");
    expect(requiredStep({ profile: { ...base, is_adult: true }, consented: false })).toBe("consent");
    expect(requiredStep({ profile: { ...base, is_adult: true }, consented: true })).toBe("university");
    expect(requiredStep({ profile: { is_adult: true, onboarded_at: "2026-10-10" }, consented: true })).toBeNull();
  });

  it("asks for consent again when the consent version changes, even after onboarding", () => {
    expect(requiredStep({ profile: { is_adult: true, onboarded_at: "2026-10-10" }, consented: false })).toBe("consent");
  });
});

describe("canOpenStep", () => {
  it("never lets a user skip the age gate", () => {
    for (const step of ["consent", "university", "level", "minutes"] as const) {
      expect(canOpenStep(step, { profile: base, consented: false })).toBe(false);
    }
  });

  it("lets an adult who agreed move between the study-profile steps but not back to the age gate", () => {
    const state = { profile: { ...base, is_adult: true }, consented: true };
    expect(canOpenStep("level", state)).toBe(true);
    expect(canOpenStep("university", state)).toBe(true);
    expect(canOpenStep("birth", state)).toBe(false);
  });

  it("lets finished users change their study profile, but not redo the age gate or consent", () => {
    const done = { profile: { is_adult: true, onboarded_at: "2026-10-10" }, consented: true };
    expect(canOpenStep("university", done)).toBe(true);
    expect(canOpenStep("minutes", done)).toBe(true);
    expect(canOpenStep("birth", done)).toBe(false);
    expect(canOpenStep("consent", done)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths only", () => {
    expect(safeNextPath("/today")).toBe("/today");
    expect(safeNextPath("https://evil.example")).toBe("/today");
    expect(safeNextPath("//evil.example")).toBe("/today");
    expect(safeNextPath("/\\evil.example")).toBe("/today");
    expect(safeNextPath(null)).toBe("/today");
  });
});
