"use client";

import dynamic from "next/dynamic";
import { useEffect, type ComponentType } from "react";
import type { Block } from "./blocks/types";

// One lazily loaded component per block type (P0-09, 02 §7): a lesson ships only the renderers
// its screens use, and each chunk stays within budget. The small text blocks share one module.
// Static skeletons while a chunk loads (07 §3.4: skeletons, not spinners; no motion).

function BlockSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-2 py-1">
      <div className="h-4 w-11/12 rounded bg-line" />
      <div className="h-4 w-4/5 rounded bg-line" />
      <div className="h-4 w-2/3 rounded bg-line" />
    </div>
  );
}

type Renderer = ComponentType<{ block: never }>;
const lazy = (load: () => Promise<Renderer>) => dynamic(load, { loading: BlockSkeleton });

const RENDERERS: Partial<Record<Block["type"], Renderer>> = {
  prose: lazy(() => import("./blocks/TextBlocks").then((m) => m.ProseBlock as Renderer)),
  callout: lazy(() => import("./blocks/TextBlocks").then((m) => m.CalloutBlock as Renderer)),
  source_quote: lazy(() => import("./blocks/TextBlocks").then((m) => m.SourceQuoteBlock as Renderer)),
  compare: lazy(() => import("./blocks/TextBlocks").then((m) => m.CompareBlock as Renderer)),
  table: lazy(() => import("./blocks/TextBlocks").then((m) => m.TableBlock as Renderer)),
  timeline: lazy(() => import("./blocks/TextBlocks").then((m) => m.TimelineBlock as Renderer)),
  math: lazy(() => import("./blocks/MathBlock").then((m) => m.MathBlock as Renderer)),
  plot: lazy(() => import("./blocks/PlotBlock").then((m) => m.PlotBlock as Renderer)),
  stepper: lazy(() => import("./blocks/StepperBlock").then((m) => m.StepperBlock as Renderer)),
  reveal: lazy(() => import("./blocks/RevealBlock").then((m) => m.RevealBlock as Renderer)),
  flashcards: lazy(() => import("./blocks/FlashcardsBlock").then((m) => m.FlashcardsBlock as Renderer)),
  checkpoint: lazy(() => import("./blocks/CheckpointBlock").then((m) => m.CheckpointBlock as Renderer)),
  // diagram and sim arrive with their tickets (labs: P1-08); until then the fallback shows.
};

type BlockRendererProps = {
  block: Block;
  onFlag: (blockId: string) => void;
};

export function BlockRenderer({ block, onFlag }: BlockRendererProps) {
  const Render = RENDERERS[block.type];
  return (
    <div className="group relative rounded-lg border border-line bg-surface p-5 sm:p-6">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => onFlag(block.id)}
          aria-label="Flag this block as wrong or unclear"
          className="min-h-11 rounded-md px-3 text-sm text-ink-2 hover:text-bad focus-visible:text-bad"
        >
          Flag
        </button>
      </div>
      {Render ? <Render block={block as never} /> : <UnknownBlock type={block.type} />}
    </div>
  );
}

/** A block this app version can't draw. Metadata only is logged (guardrail 10); Sentry in P0-14. */
function UnknownBlock({ type }: { type: string }) {
  useEffect(() => {
    console.warn("[lesson] no renderer for block type", type);
  }, [type]);
  return (
    <p className="rounded-lg border border-dashed border-line p-4 text-base text-ink-2">
      This part of the lesson can&apos;t be shown in this version of Ifiok yet. Continue to the next screen.
    </p>
  );
}
