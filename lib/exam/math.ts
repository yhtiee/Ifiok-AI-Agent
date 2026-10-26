import "server-only";
import { splitInlineMath } from "@ifiok/core/dsl/inline-math";
import { renderKatex } from "@ifiok/core/verify/katex";

// Maths in past questions and worked solutions ($…$ inline, display LaTeX in steps), rendered to
// HTML on the server with KaTeX (trust: false) so no KaTeX ships to the browser (02 §7). The map
// feeds MathHtmlProvider / RichText; anything that fails to render shows as its source.

export function mathHtmlFor(texts: string[], display: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const text of texts) {
    for (const seg of splitInlineMath(text)) {
      if (seg.kind !== "math" || out[seg.latex]) continue;
      const r = renderKatex(seg.latex, false);
      if (r.ok) out[seg.latex] = r.html;
    }
  }
  for (const latex of display) {
    const key = `display:${latex}`;
    if (out[key]) continue;
    const r = renderKatex(latex, true);
    if (r.ok) out[key] = r.html;
  }
  return out;
}
