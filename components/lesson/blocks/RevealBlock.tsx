"use client";

import { useState } from "react";
import { RichText } from "../RichText";
import type { BlockOf } from "./types";

export function RevealBlock({ block }: { block: BlockOf<"reveal"> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-base font-semibold text-ink">
        <RichText text={block.prompt} />
      </p>
      {open ? (
        <p className="mt-2 border-t border-line pt-2 text-base leading-relaxed text-ink-2">
          <RichText text={block.md} />
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="mt-2 min-h-11 text-sm font-semibold text-change hover:underline"
        >
          Show the answer
        </button>
      )}
    </div>
  );
}
