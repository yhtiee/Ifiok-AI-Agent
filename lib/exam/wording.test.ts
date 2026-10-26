import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guardrail 13: exam copy never says "predicted" or "likely to appear". Scans the source of every
// exam screen, the planner and the exam prompts, with comments stripped.

const ROOTS = [
  "components/app/exam",
  "app/(app)/courses/[id]/exam",
  "lib/exam",
  "lib/agent/planner.ts",
  "packages/core/src/ai/prompts/exam.ts",
  "packages/core/src/ai/skills/exam.ts",
];

const files = (p: string): string[] =>
  statSync(p).isDirectory()
    ? readdirSync(p).flatMap((f) => files(join(p, f)))
    : /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)
      ? [p]
      : [];

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("exam wording (guardrail 13)", () => {
  const all = ROOTS.flatMap(files);

  it("finds the exam sources", () => {
    expect(all.length).toBeGreaterThan(8);
  });

  it.each(all)("%s never says predicted or likely to appear", (file) => {
    expect(stripComments(readFileSync(file, "utf8"))).not.toMatch(
      /predict|likely to (appear|come)|will (come out|appear)/i,
    );
  });
});
