import { collectInlineMath, lessonTexts, stripMathDelimiters } from "../dsl/inline-math";
import { numericMatches } from "../dsl/numeric";
import { LessonSpec, lessonSpecSchema } from "../dsl/schema";
import { compileExpressionToAst } from "../expr/compile";
import { checkStep } from "./steps";
import { checkPlotFunction } from "./plot";
import { checkQuote, snapQuote } from "./quote";
import { renderKatex } from "./katex";
import { mathEvaluate } from "./tools";

export type SourceChunkRef = {
  id: number;
  content: string;
};

export type LessonVerificationResult = {
  ok: boolean;
  errors: string[];
  verifiedSpec: LessonSpec;
};

const MAX_LESSON_JSON_BYTES = 60 * 1024; // 60 KB budget (02 §7, 05 §6)

export type VerifyLessonOptions = {
  /** Topic lessons need 6–12 screens; micro-lessons and previews 3–6 (05 §2). Default 3. */
  minScreens?: number;
};

export { stripMathDelimiters };

/** Server-added fields: never keep values that came from the model or a client. */
const SERVER_FIELDS = new Set(["html", "compiled", "item_id", "math_html"]);

function stripServerFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripServerFields);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => !SERVER_FIELDS.has(k))
      .map(([k, v]) => [k, stripServerFields(v)]),
  );
}

/**
 * Master verification gate for Lesson DSL specs (specifications/05-lesson-and-lab-engine.md §6).
 * Runs schema validation, math verification, KaTeX pre-rendering, plot AST compilation,
 * and citation/quote checks before publishing.
 */
export function verifyLesson(
  spec: unknown,
  chunks?: SourceChunkRef[],
  options: VerifyLessonOptions = {},
): LessonVerificationResult {
  const errors: string[] = [];

  // 1. Schema validation (server-added fields from the model or a client are dropped first)
  const parsed = lessonSpecSchema.safeParse(stripServerFields(spec));
  if (!parsed.success) {
    const schemaErrors = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return {
      ok: false,
      errors: schemaErrors,
      verifiedSpec: stripServerFields(spec) as LessonSpec,
    };
  }

  // Clone spec to enrich with server-added properties (html, compiled)
  const lesson: LessonSpec = JSON.parse(JSON.stringify(parsed.data));
  normalizeExpressions(lesson);

  // 2. Size check (<= 60 KB JSON)
  const jsonBytes = new TextEncoder().encode(JSON.stringify(lesson)).length;
  if (jsonBytes > MAX_LESSON_JSON_BYTES) {
    errors.push(`Lesson JSON size (${jsonBytes} bytes) exceeds maximum 60 KB budget`);
  }

  const minScreens = options.minScreens ?? 3;
  if (lesson.screens.length < minScreens) {
    errors.push(`Lesson has ${lesson.screens.length} screens; this kind of lesson needs at least ${minScreens}`);
  }

  const chunkMap = chunks ? new Map(chunks.map((c) => [c.id, c.content])) : undefined;

  // 3. Screen and block verification
  for (let sIdx = 0; sIdx < lesson.screens.length; sIdx++) {
    const screen = lesson.screens[sIdx]!;
    for (let bIdx = 0; bIdx < screen.blocks.length; bIdx++) {
      const block = screen.blocks[bIdx]!;
      const blockPath = `screens[${sIdx}].blocks[${bIdx}] (${block.id})`;

      // Source refs check
      if (chunkMap && block.source_refs) {
        for (const ref of block.source_refs) {
          if (!chunkMap.has(ref)) {
            errors.push(`${blockPath}: references chunk_id ${ref} not present in input sources`);
          }
        }
      }

      // Block-specific verifications
      switch (block.type) {
        case "math": {
          // `html` is server-added only: never keep markup that came from the model.
          delete block.html;
          block.latex = stripMathDelimiters(block.latex);
          const katexRes = renderKatex(block.latex, block.display);
          if (!katexRes.ok) {
            errors.push(`${blockPath}: KaTeX rendering failed: ${katexRes.error}`);
          } else {
            block.html = katexRes.html;
          }
          break;
        }

        case "plot": {
          delete block.compiled;
          const defaultParams: Record<string, number> = {};
          if (block.params) {
            for (const p of block.params) {
              defaultParams[p.name] = p.value;
            }
          }

          const compiledFuncs = [];
          for (const fn of block.functions) {
            const plotRes = checkPlotFunction(fn.expr, block.x, defaultParams);
            if (!plotRes.valid) {
              errors.push(
                `${blockPath}: function '${fn.expr}' failed finiteness check (${Math.round(plotRes.finiteRatio * 100)}% finite points, min 50% required)`,
              );
            } else if (plotRes.compiledAst) {
              compiledFuncs.push(plotRes.compiledAst);
            }
          }

          // Compile annotations if present
          const compiledAnnotations: Array<Record<string, unknown>> = [];
          if (block.annotations) {
            for (const ann of block.annotations) {
              try {
                if (ann.kind === "point") {
                  compiledAnnotations.push({
                    kind: "point",
                    x: compileExpressionToAst(ann.x_expr, ["x", ...Object.keys(defaultParams)]),
                  });
                } else if (ann.kind === "vline" || ann.kind === "hline") {
                  compiledAnnotations.push({
                    kind: ann.kind,
                    val: compileExpressionToAst(ann.value_expr, ["x", ...Object.keys(defaultParams)]),
                  });
                }
              } catch (err) {
                errors.push(`${blockPath}: failed to compile annotation: ${(err as Error).message}`);
              }
            }
          }

          // A slider must change the graph: its name has to appear in a plotted expression.
          const exprs = [
            ...block.functions.map((f) => f.expr),
            ...(block.annotations ?? []).flatMap((a) => Object.values(a).filter((v) => typeof v === "string")),
          ].join(" ");
          for (const p of block.params ?? []) {
            if (!new RegExp(`(^|[^A-Za-z0-9_])${p.name}([^A-Za-z0-9_(]|$)`).test(exprs)) {
              errors.push(
                `${blockPath}: slider '${p.name}' does not appear in any plotted expression, so it changes nothing`,
              );
            }
          }

          block.compiled = {
            functions: compiledFuncs,
            annotations:
              compiledAnnotations.length > 0 ? (compiledAnnotations as Record<string, unknown>[]) : undefined,
          };
          break;
        }

        case "stepper": {
          if (block.check !== "none") {
            for (let i = 1; i < block.steps.length; i++) {
              const prev = block.steps[i - 1]!;
              const curr = block.steps[i]!;
              const prevMath = prev.mathjs || prev.latex;
              const currMath = curr.mathjs || curr.latex;

              const stepOutcome = checkStep(prevMath, currMath);
              if (stepOutcome === "wrong") {
                errors.push(
                  `${blockPath}: step ${i} ('${curr.latex}') is marked WRONG compared to step ${i - 1} ('${prev.latex}')`,
                );
              }
            }
          }
          break;
        }

        case "checkpoint": {
          const item = block.item;
          if (item.type === "numeric") {
            try {
              const computedVal = mathEvaluate(item.answer_expr);
              // Stated values may be rounded to the precision they are written with (dsl/numeric).
              if (!numericMatches(computedVal, item.stated, item.tolerance)) {
                errors.push(
                  `${blockPath}: numeric checkpoint self-consistency error: evaluate(${item.answer_expr}) = ${computedVal}, but stated = ${item.stated}`,
                );
              }
            } catch (err) {
              errors.push(`${blockPath}: numeric checkpoint answer_expr evaluation failed: ${(err as Error).message}`);
            }
          }
          break;
        }

        case "source_quote": {
          if (chunkMap) {
            const chunkContent = chunkMap.get(block.chunk_id);
            if (!chunkContent) {
              errors.push(`${blockPath}: cited chunk_id ${block.chunk_id} not found in sources`);
            } else if (!checkQuote(block.quote, chunkContent)) {
              // Same words with different punctuation: use the source's exact wording instead.
              const exact = snapQuote(block.quote, chunkContent);
              if (exact) block.quote = exact;
              else errors.push(`${blockPath}: quote "${block.quote}" is not a substring of chunk ${block.chunk_id}`);
            }
          }
          break;
        }
      }
    }
  }

  // 4. No placeholder text left by the model ("Key takeaway 1", "Term A").
  for (const text of lessonTexts(lesson)) {
    if (PLACEHOLDER.test(text.trim())) errors.push(`placeholder text left in the lesson: "${text.trim()}"`);
  }

  // 5. Inline maths ($…$ in text) pre-rendered once, so the client ships no KaTeX (02 §7). A formula
  // that won't render is left out and shows as plain text.
  const mathHtml: Record<string, string> = {};
  const stepFormulas = lesson.screens.flatMap((sc) =>
    sc.blocks.flatMap((b) => (b.type === "stepper" ? b.steps.map((st) => stripMathDelimiters(st.latex)) : [])),
  );
  for (const latex of new Set([...collectInlineMath(lesson), ...stepFormulas])) {
    const r = renderKatex(latex, false);
    if (r.ok) mathHtml[latex] = r.html;
  }
  if (Object.keys(mathHtml).length > 0) lesson.math_html = mathHtml;

  return {
    ok: errors.length === 0,
    errors,
    verifiedSpec: lesson,
  };
}

const PLACEHOLDER =
  /^(key\s+takeaways?(\s*[0-9]+)?|(takeaway|term|definition|concept|point|option|item|example|step|col(umn)?|val(ue)?|row|fact|answer)\s*([0-9]+|[a-d]))$/i;

/**
 * Expression syntax with exactly one meaning that mathjs spells differently: `**` (Python/JS power)
 * becomes `^`. Applied to every engine-evaluated expression before checking; nothing else changes.
 */
function normalizeExpressions(lesson: LessonSpec): void {
  const fix = (e: string) => e.replace(/\*\*/g, "^");
  for (const screen of lesson.screens) {
    for (const block of screen.blocks) {
      if (block.type === "plot") {
        for (const f of block.functions) f.expr = fix(f.expr);
        for (const a of block.annotations ?? []) {
          for (const [k, v] of Object.entries(a))
            if (k.endsWith("_expr") && typeof v === "string") (a as Record<string, unknown>)[k] = fix(v);
        }
      } else if (block.type === "stepper") {
        for (const st of block.steps) if (st.mathjs) st.mathjs = fix(st.mathjs);
      } else if (block.type === "checkpoint" && (block.item.type === "numeric" || block.item.type === "expression")) {
        block.item.answer_expr = fix(block.item.answer_expr);
      }
    }
  }
}
