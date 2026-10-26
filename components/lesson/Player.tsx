"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { lessonLabel } from "@/lib/lessons/label";
import type { LessonRow } from "@/lib/lessons/types";
import { BlockRenderer } from "./BlockRenderer";
import { CitationLine, CitationProvider } from "./Citations";
import { EvidenceProvider, useEvidence } from "./Evidence";
import { MathHtmlProvider } from "./RichText";
import type { Block } from "@ifiok/core/dsl/schema";

// The lesson player (07 §5.3, app-overhaul §5.6): a focused screen. Progress and the trust label
// on top, the screen's blocks, and a bar in the thumb zone (Previous, Continue). The key takeaways
// are shown on the finish screen only, after the student has worked through the lesson. Copy
// never claims a mastery change: nothing records learning until /api/sync (MVP-03).

export type LessonLink = { href: string; label: string };

type PlayerProps = {
  lesson: LessonRow;
  /** A private lesson: "From your notes, p. 12" per cited chunk id (MVP-02). */
  citations?: Record<string, string>;
  /** The finish screen's primary action: the next topic in the outline, when there is one. */
  next?: LessonLink | null;
  /** Otherwise back to the course (or Courses). */
  back: LessonLink;
};

// The flag dialog loads when a student flags a block, not with the lesson.
const FlagModal = dynamic(() => import("./FlagModal").then((m) => m.FlagModal), { ssr: false });

const NO_CITATIONS: Record<string, string> = {};

const bar =
  "fixed inset-x-0 bottom-0 z-10 flex gap-3 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 lg:sticky lg:bottom-0 lg:mt-2 lg:bg-paper lg:px-0 lg:pb-4";

export function Player(props: PlayerProps) {
  return (
    <EvidenceProvider lessonId={props.lesson.id}>
      <PlayerBody {...props} />
    </EvidenceProvider>
  );
}

function PlayerBody({ lesson, citations = NO_CITATIONS, next, back }: PlayerProps) {
  const evidence = useEvidence();
  const [screenIndex, setScreenIndex] = useState(0);
  const [flaggingBlockId, setFlaggingBlockId] = useState<string | null>(null);

  const screens = lesson.spec.screens;
  const currentScreen = screens[screenIndex];
  const isLastScreen = screenIndex === screens.length - 1;
  const isCompleted = screenIndex >= screens.length;

  // Moving forward finishes the screen being left (evidence for /api/sync, MVP-03).
  const go = (index: number) => {
    const leaving = screens[screenIndex];
    if (index > screenIndex && leaving) evidence.screenDone(leaving.id);
    setScreenIndex(index);
    window.scrollTo({ top: 0 });
  };

  const flagModal = flaggingBlockId ? (
    <FlagModal
      isOpen={Boolean(flaggingBlockId)}
      lessonId={lesson.id}
      blockId={flaggingBlockId}
      onClose={() => setFlaggingBlockId(null)}
      onSuccess={() => toast("Flag sent. A curator will check this block.")}
    />
  ) : null;

  if (isCompleted) {
    const primary = next ?? back;
    return (
      <section aria-labelledby="lesson-done" className="grid grid-cols-1 gap-5">
        <h2 id="lesson-done" className="font-display text-xl font-semibold">
          {lesson.spec.title}: done
        </h2>
        {lesson.spec.summary.length ? (
          <div className="grid gap-2">
            <h3 className="text-base font-semibold">Key takeaways</h3>
            <ul className="grid max-w-[66ch] list-disc gap-2 pl-5 text-base marker:text-built">
              {lesson.spec.summary.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div data-action-bar="" className={bar}>
          <Button variant="outline" onClick={() => go(0)} className="flex-1 lg:order-2 lg:flex-none">
            Go through it again
          </Button>
          <Button asChild className="flex-1 lg:flex-none">
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
        </div>
        {flagModal}
      </section>
    );
  }

  const step = screenIndex + 1;
  return (
    <div className="grid grid-cols-1 gap-5">
      {flagModal}
      <div className="grid gap-2">
        <Progress value={(step / screens.length) * 100} aria-label={`Screen ${step} of ${screens.length}`} />
        <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-ink-2">
          <span className="tabular-nums">
            {step} of {screens.length} · ~{lesson.spec.est_minutes} min
          </span>
          <span>{lessonLabel(lesson)}</span>
        </p>
      </div>

      <MathHtmlProvider value={lesson.spec.math_html}>
        <CitationProvider value={citations}>
          <ScreenBlocks
            blocks={(currentScreen?.blocks ?? []).filter((b) => !lesson.hidden_blocks.includes(b.id))}
            render={(block) => (
              <>
                <BlockRenderer block={block} onFlag={(id) => setFlaggingBlockId(id)} />
                {block.type === "source_quote" ? null : <CitationLine refs={block.source_refs} />}
              </>
            )}
          />
        </CitationProvider>
      </MathHtmlProvider>

      <div data-action-bar="" className={bar}>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12"
          onClick={() => go(screenIndex - 1)}
          disabled={screenIndex === 0}
          aria-label="Previous screen"
        >
          <ArrowLeftIcon size={22} aria-hidden="true" />
        </Button>
        <Button onClick={() => go(screenIndex + 1)} className="flex-1 lg:max-w-xs">
          {isLastScreen ? "Finish" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

/** Blocks the student looks at or works with; they take the wide right column on large screens. */
const VISUAL_BLOCKS: ReadonlySet<Block["type"]> = new Set([
  "plot",
  "diagram",
  "stepper",
  "table",
  "compare",
  "flashcards",
  "sim",
]);

/**
 * One lesson screen. Phones: the blocks in order, one column. Large screens: when the screen has a
 * visual (graph, diagram, worked steps, table) and text, the text and questions sit on the left at a
 * readable line length and the visual on the right, staying in view, so the width is used and the
 * student scrolls less. Each block keeps its place in reading order (CSS order) on phones.
 */
function ScreenBlocks({ blocks, render }: { blocks: Block[]; render: (block: Block) => ReactNode }) {
  const visuals = blocks.filter((b) => VISUAL_BLOCKS.has(b.type));
  const text = blocks.filter((b) => !VISUAL_BLOCKS.has(b.type));
  const item = (block: Block) => (
    <div key={block.id} style={{ order: blocks.indexOf(block) }} className="grid min-w-0 grid-cols-1 gap-4">
      {render(block)}
    </div>
  );

  if (visuals.length === 0 || text.length === 0) {
    return (
      <div className={`grid grid-cols-1 gap-4 ${visuals.length ? "max-w-4xl" : "max-w-[70ch]"}`}>
        {blocks.map(item)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start lg:gap-8">
      <div className="contents lg:grid lg:max-w-[70ch] lg:grid-cols-1 lg:gap-4">{text.map(item)}</div>
      <div className="contents lg:sticky lg:top-24 lg:grid lg:grid-cols-1 lg:gap-4">{visuals.map(item)}</div>
    </div>
  );
}
