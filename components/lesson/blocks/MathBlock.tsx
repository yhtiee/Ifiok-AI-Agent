"use client";

import type { BlockOf } from "./types";

/**
 * Renders KaTeX HTML that the server pre-rendered at save time (trust: false). The model's own
 * `html` is discarded by verifyLesson, so this is never AI-supplied markup (guardrail 3).
 */
export function MathBlock({ block }: { block: BlockOf<"math"> }) {
  return (
    // Centred with mx-auto, not justify-center: a formula wider than the column then scrolls from its
    // start instead of spilling past the left edge where it can't be reached.
    <div className="my-2 max-w-full overflow-x-auto overflow-y-hidden py-2">
      {block.html ? (
        <div className="mx-auto w-fit" dangerouslySetInnerHTML={{ __html: block.html }} />
      ) : (
        <code className="block text-sm break-all text-quantity">{block.latex}</code>
      )}
    </div>
  );
}
