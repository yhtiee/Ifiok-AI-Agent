"use client";

import type { BlockOf } from "./types";

/**
 * Renders KaTeX HTML that the server pre-rendered at save time (trust: false). The model's own
 * `html` is discarded by verifyLesson, so this is never AI-supplied markup (guardrail 3).
 */
export function MathBlock({ block }: { block: BlockOf<"math"> }) {
  return (
    <div className="my-2 flex justify-center overflow-x-auto py-2">
      {block.html ? (
        <div dangerouslySetInnerHTML={{ __html: block.html }} />
      ) : (
        <code className="text-sm text-quantity">{block.latex}</code>
      )}
    </div>
  );
}
