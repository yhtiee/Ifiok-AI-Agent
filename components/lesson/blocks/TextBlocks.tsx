"use client";

import { RichText } from "../RichText";
import type { BlockOf } from "./types";

// Light, static blocks. Each is still its own lazy chunk entry in BlockRenderer.

export function ProseBlock({ block }: { block: BlockOf<"prose"> }) {
  return (
    <div className="space-y-3 text-base leading-relaxed text-ink">
      {block.md.split("\n\n").map((p, i) => (
        <p key={i}>
          <RichText text={p} />
        </p>
      ))}
    </div>
  );
}

const CALLOUT_LABEL: Record<BlockOf<"callout">["variant"], string> = {
  tip: "Tip",
  mistake: "Common mistake",
  exam: "In exams",
  realworld: "In real life",
};

export function CalloutBlock({ block }: { block: BlockOf<"callout"> }) {
  const tone =
    block.variant === "mistake"
      ? "border-change bg-change-soft"
      : block.variant === "tip"
        ? "border-built bg-built-soft"
        : "border-quantity bg-quantity-soft";
  return (
    <aside className={`rounded-lg border-l-4 p-4 ${tone}`}>
      <p className="text-sm font-semibold text-ink">{CALLOUT_LABEL[block.variant]}</p>
      <p className="mt-1 text-base leading-relaxed text-ink">
        <RichText text={block.md} />
      </p>
    </aside>
  );
}

export function SourceQuoteBlock({ block }: { block: BlockOf<"source_quote"> }) {
  return (
    <blockquote className="border-l-4 border-change pl-4 text-ink">
      <p className="text-base leading-relaxed italic">&ldquo;{block.quote}&rdquo;</p>
      <footer className="mt-2 text-sm text-ink-2">
        Approved course material{block.page ? `, page ${block.page}` : ""}
      </footer>
    </blockquote>
  );
}

export function CompareBlock({ block }: { block: BlockOf<"compare"> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[block.left, block.right].map((side, i) => (
        <div key={i} className="rounded-lg border border-line bg-paper p-4">
          <h4 className={`mb-2 text-sm font-semibold ${i === 0 ? "text-quantity" : "text-change"}`}>
            <RichText text={side.title} />
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-ink">
            {side.points.map((pt, j) => (
              <li key={j}>
                <RichText text={pt} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function TableBlock({ block }: { block: BlockOf<"table"> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-ink-2">
            {block.columns.map((col, i) => (
              <th key={i} scope="col" className="pb-2 font-semibold">
                <RichText text={col} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="py-2 text-ink">
                  <RichText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TimelineBlock({ block }: { block: BlockOf<"timeline"> }) {
  return (
    <ol className="space-y-3 border-l-2 border-quantity pl-4">
      {block.events.map((e, i) => (
        <li key={i} className="text-base text-ink">
          <span className="font-semibold text-quantity">{e.when}</span> · <RichText text={e.label} />
          {e.detail ? (
            <p className="text-sm text-ink-2">
              <RichText text={e.detail} />
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
