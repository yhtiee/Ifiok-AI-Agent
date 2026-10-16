"use client";

import { splitInlineMath } from "@ifiok/core/dsl/inline-math";
import { createContext, useContext, type ReactNode } from "react";

// Lesson text with inline maths ($x^2$). Formulas show the KaTeX HTML the server rendered when the
// lesson was saved (spec.math_html, our own output with trust: false), so no KaTeX ships to the
// browser. Text is always rendered as text, never as HTML (guardrail 3).

const MathHtmlContext = createContext<Record<string, string>>({});

export function MathHtmlProvider({ value, children }: { value?: Record<string, string>; children: ReactNode }) {
  return <MathHtmlContext.Provider value={value ?? {}}>{children}</MathHtmlContext.Provider>;
}

/** One pre-rendered formula, or its source as plain text when it couldn't be rendered. */
export function Formula({ latex }: { latex: string }) {
  const html = useContext(MathHtmlContext)[latex];
  return html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <code className="text-quantity">{latex}</code>;
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {splitInlineMath(text).map((seg, i) =>
        seg.kind === "math" ? <Formula key={i} latex={seg.latex} /> : <span key={i}>{seg.text}</span>,
      )}
    </>
  );
}
