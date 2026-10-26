import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LessonSpec } from "@ifiok/core";
import { describe, expect, it, vi } from "vitest";
import type { ClaimCheckOutput } from "@ifiok/core/ai/skills/claim-check";
import { lessonLabel } from "./label";
import { citedChunkIds, claimTexts, runLessonPipeline, type PipelineDeps } from "./pipeline";

// F2-FR5 publishing decisions with fake model calls: nothing that fails a check is published.

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "content/fixtures/slope-of-a-curve.json"), "utf-8"),
) as LessonSpec;
const clone = (): LessonSpec => JSON.parse(JSON.stringify(fixture));

const CHUNKS = [
  { id: 11, content: "The slope of a curve at a point is the slope of its tangent line." },
  { id: 12, content: "A secant line joins two points on a curve." },
];

/** The fixture as a humanities lesson whose prose cites chunk 11. */
function humanitiesSpec(): LessonSpec {
  const spec = clone();
  spec.subject_profile = "humanities";
  for (const screen of spec.screens) {
    for (const block of screen.blocks) {
      if (block.type === "prose" || block.type === "callout") block.source_refs = [11];
    }
  }
  return spec;
}

function deps(output: unknown, claims?: ClaimCheckOutput): PipelineDeps & { claimCheck: ReturnType<typeof vi.fn> } {
  return {
    generate: async () => ({ output, model: "test-model" }),
    claimCheck: vi.fn(async () => claims ?? { claims: [], all_grounded: true }),
  };
}

describe("runLessonPipeline", () => {
  it("publishes a STEM lesson that passes every check, with no claim check", async () => {
    const d = deps(clone());
    const r = await runLessonPipeline(d, { chunks: [], sensitive: false });
    expect(r).toMatchObject({ status: "published", reason: "passed", sourcesUsed: 0, issues: [] });
    expect(d.claimCheck).not.toHaveBeenCalled();
    // Server-added fields are filled in by the verifier.
    const math = r.spec.screens.flatMap((s) => s.blocks).find((b) => b.type === "math");
    if (math?.type === "math") expect(math.html).toContain("katex");
  });

  it("sends a lesson with a wrong numeric checkpoint to review, never published", async () => {
    const spec = clone();
    const cp = spec.screens.flatMap((s) => s.blocks).find((b) => b.type === "checkpoint" && b.item.type === "numeric");
    expect(cp).toBeDefined();
    if (cp?.type === "checkpoint" && cp.item.type === "numeric") cp.item.stated += 1;
    const r = await runLessonPipeline(deps(spec), { chunks: [], sensitive: false });
    expect(r).toMatchObject({ status: "review", reason: "checks_failed" });
    expect(r.issues.join(" ")).toMatch(/self-consistency/);
  });

  it("repairs a failed lesson once with the verifier's errors, then checks it again from scratch", async () => {
    const broken = clone();
    const cp = broken.screens
      .flatMap((s) => s.blocks)
      .find((b) => b.type === "checkpoint" && b.item.type === "numeric");
    if (cp?.type === "checkpoint" && cp.item.type === "numeric") cp.item.stated += 1;
    const repair = vi.fn(async () => ({ output: clone(), model: "repair-model" }));
    const r = await runLessonPipeline({ ...deps(broken), repair }, { chunks: [], sensitive: false });
    expect(repair).toHaveBeenCalledOnce();
    expect((repair.mock.calls[0] as unknown as [unknown, string[]])[1].join(" ")).toMatch(/self-consistency/);
    expect(r).toMatchObject({ status: "published", repaired: true, model: "repair-model", issues: [] });
  });

  it("still sends the lesson to review when the repair is wrong too, or the repair call fails", async () => {
    const broken = () => {
      const s = clone();
      const cp = s.screens.flatMap((x) => x.blocks).find((b) => b.type === "checkpoint" && b.item.type === "numeric");
      if (cp?.type === "checkpoint" && cp.item.type === "numeric") cp.item.stated += 1;
      return s;
    };
    const stillWrong = await runLessonPipeline(
      { ...deps(broken()), repair: async () => ({ output: broken(), model: "m" }) },
      { chunks: [], sensitive: false },
    );
    expect(stillWrong).toMatchObject({ status: "review", reason: "checks_failed", repaired: false });
    const failedCall = await runLessonPipeline(
      {
        ...deps(broken()),
        repair: async () => {
          throw new Error("provider down");
        },
      },
      { chunks: [], sensitive: false },
    );
    expect(failedCall).toMatchObject({ status: "review", reason: "checks_failed" });
  });

  it("sends a lesson with invalid LaTeX to review", async () => {
    const spec = clone();
    spec.screens[0]!.blocks[0] = { id: "s1b1", type: "math", latex: "\\frac{1}{", display: true };
    const r = await runLessonPipeline(deps(spec), { chunks: [], sensitive: false });
    expect(r.status).toBe("review");
    expect(r.issues.join(" ")).toMatch(/KaTeX/);
  });

  it("fails a lesson that cites a chunk it was not given (no private or foreign sources)", async () => {
    const spec = clone();
    spec.screens[0]!.blocks[0]!.source_refs = [999];
    const r = await runLessonPipeline(deps(spec), { chunks: CHUNKS, sensitive: false });
    expect(r.status).toBe("review");
    expect(r.sourceRefs).toEqual([]);
  });

  it("discards html the model tried to supply", async () => {
    const spec = clone();
    spec.screens[0]!.blocks[0] = {
      id: "s1b1",
      type: "math",
      latex: "x^2",
      display: true,
      html: "<img src=x onerror=alert(1)>",
    };
    const r = await runLessonPipeline(deps(spec), { chunks: [], sensitive: false });
    const math = r.spec.screens[0]!.blocks[0]!;
    expect(math.type === "math" && math.html).not.toContain("onerror");
  });

  it("keeps a sensitive-subject lesson for a curator even when it passes", async () => {
    const r = await runLessonPipeline(deps(clone()), { chunks: [], sensitive: true });
    expect(r).toMatchObject({ status: "review", reason: "curator" });
  });

  it("claim-checks a non-STEM lesson against only the chunks it cites", async () => {
    const d = deps(humanitiesSpec());
    const r = await runLessonPipeline(d, { chunks: CHUNKS, sensitive: false });
    expect(d.claimCheck).toHaveBeenCalledOnce();
    const input = d.claimCheck.mock.calls[0]![0] as { chunks: { id: number }[]; blocks: { block_id: string }[] };
    expect(input.chunks.map((c) => c.id)).toEqual([11]);
    expect(input.blocks.map((b) => b.block_id)).toEqual(["s1b1", "s4b1", "s4b2"]);
    expect(r).toMatchObject({ status: "published", sourcesUsed: 1, sourceRefs: [11] });
  });

  it("removes a block with unsupported claims and publishes when the lesson still passes", async () => {
    const d = deps(humanitiesSpec(), {
      claims: [{ text: "x", block_id: "s4b1", supported_by: null }],
      all_grounded: false,
    });
    const r = await runLessonPipeline(d, { chunks: CHUNKS, sensitive: false });
    expect(r.status).toBe("published");
    expect(r.spec.screens.flatMap((s) => s.blocks).map((b) => b.id)).not.toContain("s4b1");
  });

  it("sends the lesson to review when removing unsupported blocks breaks it", async () => {
    const d = deps(humanitiesSpec(), {
      claims: [
        { text: "x", block_id: "s4b1", supported_by: null },
        { text: "y", block_id: "s4b2", supported_by: null },
      ],
      all_grounded: false,
    });
    const r = await runLessonPipeline(d, { chunks: CHUNKS, sensitive: false });
    expect(r).toMatchObject({ status: "review", reason: "checks_failed" });
  });

  it("skips the claim check and labels a non-STEM lesson with no sources as a general explanation", async () => {
    const spec = clone();
    spec.subject_profile = "humanities";
    const d = deps(spec);
    const r = await runLessonPipeline(d, { chunks: [], sensitive: false });
    expect(d.claimCheck).not.toHaveBeenCalled();
    expect(lessonLabel({ trust: "new", sources_used: r.sourcesUsed, spec: r.spec })).toBe(
      "General explanation (not from course material)",
    );
  });

  it("does not swallow model errors (the job fails and refunds)", async () => {
    const d: PipelineDeps = {
      generate: async () => {
        throw new Error("provider down");
      },
      claimCheck: vi.fn(),
    };
    await expect(runLessonPipeline(d, { chunks: [], sensitive: false })).rejects.toThrow("provider down");
  });
});

describe("helpers", () => {
  it("collects claim text from prose, callouts, tables and flashcards only", () => {
    expect(claimTexts(fixture).map((b) => b.block_id)).toEqual(["s1b1", "s4b1", "s4b2"]);
  });

  it("collects cited chunk ids from source_refs and source quotes", () => {
    const spec = clone();
    spec.screens[0]!.blocks[0]!.source_refs = [3, 4];
    spec.screens[3]!.blocks[0] = { id: "q", type: "source_quote", chunk_id: 5, quote: "a line" };
    expect(citedChunkIds(spec).sort()).toEqual([3, 4, 5]);
  });

  it("labels lessons as the spec says", () => {
    const stem = { subject_profile: "stem" as const };
    const hum = { subject_profile: "humanities" as const };
    expect(lessonLabel({ trust: "new", sources_used: 0, spec: stem })).toBe(
      "New lesson. Checked by Ifiok's maths engine",
    );
    expect(lessonLabel({ trust: "new", sources_used: 3, spec: hum })).toBe("New lesson. Based on 3 sources");
    expect(lessonLabel({ trust: "trusted", sources_used: 0, spec: hum })).toBe("Trusted lesson");
    // Private lessons from the student's own materials (MVP-02).
    expect(lessonLabel({ trust: "new", sources_used: 2, owner_id: "u", spec: stem })).toBe(
      "Built from your notes. Checked by Ifiok's maths engine",
    );
    expect(lessonLabel({ trust: "new", sources_used: 2, owner_id: "u", spec: hum })).toBe(
      "Built from your notes (2 passages)",
    );
  });

  it("publishes a lesson whose quote only changed the source's punctuation, with the exact wording", async () => {
    const spec = clone();
    const id = `s1b${spec.screens[0]!.blocks.length + 1}`;
    spec.screens[0]!.blocks.push({
      id,
      type: "source_quote",
      chunk_id: 11,
      quote: "The slope of a curve, at a point, is the slope of its tangent line!",
    });
    const r = await runLessonPipeline(deps(spec), { chunks: CHUNKS, sensitive: false });
    expect(r.issues).toEqual([]);
    expect(r.status).toBe("published");
    const quote = r.spec.screens[0]!.blocks.find((b) => b.id === id);
    expect(quote?.type === "source_quote" && quote.quote).toBe(
      "The slope of a curve at a point is the slope of its tangent line.",
    );
  });
});

describe("lesson_generate output", () => {
  it("rejects a topic lesson under 6 screens with a message the repair call can act on", async () => {
    const { lessonGenerateOutput } = await import("@ifiok/core/ai/skills/lesson-generate");
    const short = clone();
    short.screens = short.screens.filter((s) => s.id !== "s5"); // keeps both checkpoints
    const r = lessonGenerateOutput.safeParse(short);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/at least 6 screens/);
    expect(lessonGenerateOutput.safeParse(clone()).success).toBe(true);
  });
});
