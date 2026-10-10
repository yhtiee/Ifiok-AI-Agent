import { describe, expect, it } from "vitest";
import { extractJson, findControlCharIssues } from "./json";

describe("extractJson", () => {
  it("reads plain, fenced and wrapped JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here it is: {"a":1} hope that helps')).toEqual({ a: 1 });
  });
  it("throws on non-JSON and truncated JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
    expect(() => extractJson('{"a": [1, 2')).toThrow();
  });
});

describe("findControlCharIssues", () => {
  it("flags unescaped LaTeX that became control characters", () => {
    // JSON "\frac" → form feed + "rac"; "\theta" → tab + "heta"
    // The model wrote one backslash in JSON text: JSON.parse turns \f into a form feed, \t into a tab.
    expect(findControlCharIssues(JSON.parse(String.raw`{"latex":"\frac{1}{2}"}`))).toHaveLength(1);
    expect(findControlCharIssues(JSON.parse(String.raw`{"steps":[{"why":"use \theta"}]}`))).toHaveLength(1);
  });
  it("flags a newline followed by letters in LaTeX fields and inline maths only", () => {
    expect(findControlCharIssues({ latex: "a \neq b" })).toHaveLength(1); // "\neq" unescaped
    expect(findControlCharIssues({ stem_md: "Find $x \nu$ now" })).toHaveLength(1);
    expect(findControlCharIssues({ stem_md: "Line one\nLine two" })).toHaveLength(0); // ordinary prose
    expect(findControlCharIssues({ caption: "Line one\nLine two" })).toHaveLength(0);
  });
  it("accepts correctly escaped LaTeX", () => {
    // Correct JSON escapes the backslash: \\frac parses to the text \frac.
    expect(findControlCharIssues(JSON.parse(String.raw`{"latex":"\\frac{1}{2} \\neq \\theta"}`))).toEqual([]);
  });
});
