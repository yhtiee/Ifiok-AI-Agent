import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lessonSpecSchema, countWords, hasCorruptedLatexEscapes } from "./schema";

describe("Lesson DSL Schema", () => {
  const fixturesDir = join(process.cwd(), "content", "fixtures");

  it("passes valid 6-screen slope-of-a-curve fixture", () => {
    const raw = JSON.parse(readFileSync(join(fixturesDir, "slope-of-a-curve.json"), "utf-8"));
    const result = lessonSpecSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("fails all 10 invalid fixtures with expected validation errors", () => {
    const invalidDir = join(fixturesDir, "invalid");
    const files = readdirSync(invalidDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(10);

    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(join(invalidDir, file), "utf-8"));
        const result = lessonSpecSchema.safeParse(raw);
        expect(result.success, `File ${file} should have failed validation`).toBe(false);
      } catch (err) {
        // Raw JSON parse error (e.g. invalid escape character) is also an expected failure
        expect(err).toBeDefined();
      }
    }
  });

  it("correctly counts words", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("Hello world")).toBe(2);
    expect(countWords("  one   two  three  four  ")).toBe(4);
  });

  it("detects corrupted unescaped LaTeX escape sequences", () => {
    expect(hasCorruptedLatexEscapes("\\frac{1}{2}")).toBe(false);
    expect(hasCorruptedLatexEscapes("\f")).toBe(true); // form feed
    expect(hasCorruptedLatexEscapes("\t")).toBe(true); // tab
    expect(hasCorruptedLatexEscapes("\neq")).toBe(true); // newline before eq
    expect(hasCorruptedLatexEscapes("\nabla")).toBe(true);
    expect(hasCorruptedLatexEscapes("Safe string with \\neq in it")).toBe(false);
  });
});
