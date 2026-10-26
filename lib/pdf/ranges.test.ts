import { describe, expect, it } from "vitest";
import { parsePageRanges } from "./ranges";

describe("parsePageRanges", () => {
  it("reads single pages and ranges in any order, without duplicates", () => {
    expect(parsePageRanges("8, 1-3, 2", 10)).toEqual({ ok: true, pages: [1, 2, 3, 8] });
  });

  it("accepts en dashes and spaces around the dash", () => {
    expect(parsePageRanges("4 – 6 9", 10)).toEqual({ ok: true, pages: [4, 5, 6, 9] });
  });

  it("refuses pages past the end, backwards ranges and words", () => {
    expect(parsePageRanges("9-12", 10).ok).toBe(false);
    expect(parsePageRanges("5-3", 10).ok).toBe(false);
    expect(parsePageRanges("chapter 2", 10).ok).toBe(false);
    expect(parsePageRanges("0", 10).ok).toBe(false);
    expect(parsePageRanges("  ", 10).ok).toBe(false);
  });
});
