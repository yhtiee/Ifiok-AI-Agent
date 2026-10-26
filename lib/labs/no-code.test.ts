import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 10 MVP-05 "Done when": no AI-written code or HTML anywhere in a lab (guardrail 3). Lab screens
// render configuration fields as text and evaluate formulas only through the allow-listed AST.

const ROOTS = ["components/labs", "components/app/labs", "app/(app)/labs", "lib/labs", "packages/core/src/labs"];

const files = (p: string): string[] =>
  statSync(p).isDirectory()
    ? readdirSync(p).flatMap((f) => files(join(p, f)))
    : /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)
      ? [p]
      : [];

describe("labs never run or render generated code", () => {
  const all = ROOTS.flatMap(files);

  it("finds the lab sources", () => {
    expect(all.length).toBeGreaterThan(8);
  });

  it.each(all)("%s has no HTML injection or dynamic evaluation", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/dangerouslySetInnerHTML|\beval\(|new Function\(|innerHTML/);
  });
});
