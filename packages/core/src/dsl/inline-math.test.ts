import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyLesson } from "../verify/lesson";
import { collectInlineMath, splitInlineMath } from "./inline-math";
import type { LessonSpec } from "./schema";

const fixture = (): LessonSpec =>
  JSON.parse(readFileSync(join(process.cwd(), "content/fixtures/slope-of-a-curve.json"), "utf-8"));

describe("splitInlineMath", () => {
  it("splits $…$ formulas out of text", () => {
    expect(splitInlineMath(String.raw`The slope of $y = x^2$ is $2x$.`)).toEqual([
      { kind: "text", text: "The slope of " },
      { kind: "math", latex: "y = x^2" },
      { kind: "text", text: " is " },
      { kind: "math", latex: "2x" },
      { kind: "text", text: "." },
    ]);
  });

  it("leaves money and lone dollar signs as text", () => {
    expect(splitInlineMath("It costs $5 and $10 today.")).toEqual([
      { kind: "text", text: "It costs $5 and $10 today." },
    ]);
    expect(splitInlineMath("Pay $ 3")).toEqual([{ kind: "text", text: "Pay $ 3" }]);
  });

  it("handles a single-character formula", () => {
    expect(splitInlineMath("Let $x$ grow")).toEqual([
      { kind: "text", text: "Let " },
      { kind: "math", latex: "x" },
      { kind: "text", text: " grow" },
    ]);
  });
});

describe("inline maths in verifyLesson", () => {
  it("pre-renders every inline formula once into math_html", () => {
    const spec = fixture();
    spec.screens[0]!.blocks[0] = {
      id: "s1b1",
      type: "prose",
      md: String.raw`Here $\frac{1}{x}$ and again $\frac{1}{x}$, plus $x^2$.`,
    };
    expect(collectInlineMath(spec)).toEqual(expect.arrayContaining([String.raw`\frac{1}{x}`, "x^2"]));
    const r = verifyLesson(spec);
    expect(r.ok).toBe(true);
    expect(r.verifiedSpec.math_html?.[String.raw`\frac{1}{x}`]).toContain("katex");
    expect(r.verifiedSpec.math_html?.["x^2"]).toContain("katex");
  });

  it("drops math_html and item_id a model tries to supply", () => {
    const spec = fixture() as LessonSpec & { math_html: Record<string, string> };
    spec.math_html = { evil: "<img src=x onerror=alert(1)>" };
    const cp = spec.screens.flatMap((s) => s.blocks).find((b) => b.type === "checkpoint");
    if (cp?.type === "checkpoint") cp.item_id = "00000000-0000-4000-8000-000000000000";
    const r = verifyLesson(spec);
    expect(JSON.stringify(r.verifiedSpec)).not.toContain("onerror");
    expect(JSON.stringify(r.verifiedSpec)).not.toContain("00000000-0000-4000-8000-000000000000");
  });
});

describe("verifier quality checks", () => {
  it("rejects a plot slider that no plotted expression uses", () => {
    const spec = fixture();
    spec.screens[0]!.blocks[1] = {
      id: "s1b2",
      type: "plot",
      x: [-5, 5],
      functions: [{ expr: "x^2", role: "quantity" }],
      params: [{ name: "a", min: 1, max: 3, value: 1, step: 0.5, label: "a" }],
    };
    const r = verifyLesson(spec);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/slider 'a'/);
  });

  it("accepts a slider that is used", () => {
    const spec = fixture();
    spec.screens[0]!.blocks[1] = {
      id: "s1b2",
      type: "plot",
      x: [-5, 5],
      functions: [{ expr: "a * x^2", role: "quantity" }],
      params: [{ name: "a", min: 1, max: 3, value: 1, step: 0.5, label: "a" }],
    };
    expect(verifyLesson(spec).ok).toBe(true);
  });

  it("rejects placeholder text but not real headings", () => {
    const bad = fixture();
    bad.summary = ["Key takeaway 1", "Key takeaway 2"];
    expect(verifyLesson(bad).errors.join(" ")).toMatch(/placeholder/);

    const ok = fixture();
    ok.screens[3]!.blocks[0] = {
      id: "s4b1",
      type: "table",
      columns: ["Term", "Definition"],
      rows: [["Slope", "Rise over run"]],
    };
    expect(verifyLesson(ok).errors.join(" ")).not.toMatch(/placeholder/);
  });
});
