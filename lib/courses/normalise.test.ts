import { describe, expect, it } from "vitest";
import { cleanTitle, conceptSlug, courseCodeNorm, formatCourseCode, levelBandFor } from "./normalise";

describe("course codes", () => {
  it("formats the ways students type a code", () => {
    for (const raw of ["mth101", "MTH 101", "Mth-101", " mth  101 ", "MTH/101"]) {
      expect(formatCourseCode(raw)).toBe("MTH 101");
    }
    expect(formatCourseCode("GST 111")).toBe("GST 111");
    expect(formatCourseCode("CSC 201A")).toBe("CSC 201A");
  });
  it("rejects text that isn't a course code", () => {
    expect(formatCourseCode("calculus")).toBeNull();
    expect(formatCourseCode("101")).toBeNull();
  });
  it("normalises like the database column", () => {
    expect(courseCodeNorm("Mth-101")).toBe("MTH101");
  });
});

describe("levelBandFor", () => {
  const bands = { default: "introductory", "100": "introductory", "200": "intermediate", "400": "advanced" };
  it("maps levels to bands, with a default", () => {
    expect(levelBandFor(200, bands)).toBe("intermediate");
    expect(levelBandFor(400, bands)).toBe("advanced");
    expect(levelBandFor(null, bands)).toBe("introductory");
    expect(levelBandFor(900, bands)).toBe("introductory");
  });
});

describe("conceptSlug and cleanTitle", () => {
  it("builds stable slugs", () => {
    expect(conceptSlug("mathematics", "Limits of a Function!")).toBe("mathematics.limits-of-a-function");
    expect(conceptSlug("law", "Ratio decidendi & obiter dicta")).toBe("law.ratio-decidendi-obiter-dicta");
    expect(conceptSlug("physics", "???")).toBe("physics.topic");
  });
  it("tidies typed titles", () => {
    expect(cleanTitle("  Newton's   laws \n of motion ")).toBe("Newton's laws of motion");
  });
});
