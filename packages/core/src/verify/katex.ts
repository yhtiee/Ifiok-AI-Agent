import katex from "katex";

// Server-side KaTeX pre-renderer (specifications/05-lesson-and-lab-engine.md §3).
// Pre-renders KaTeX at save time (trust: false, output: 'htmlAndMathml') into `html`,
// so the student's browser ships only lightweight CSS and fonts without loading KaTeX JS.

export type KatexRenderResult = {
  html: string;
  ok: boolean;
  error?: string;
};

/**
 * Pre-renders LaTeX to sanitized HTML string with trust: false.
 */
export function renderKatex(latex: string, display = true): KatexRenderResult {
  if (latex.length > 2000) return { html: "", ok: false, error: "formula too long" };
  try {
    const html = katex.renderToString(latex, {
      displayMode: display,
      // Invalid LaTeX must fail the verification gate, not render as red error text.
      throwOnError: true,
      trust: false,
      output: "htmlAndMathml",
    });
    return { html, ok: true };
  } catch (err: unknown) {
    return {
      html: "",
      ok: false,
      error: (err as Error).message,
    };
  }
}
