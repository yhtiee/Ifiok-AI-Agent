"use client";

import { useState } from "react";
import { EmptyState, Panel } from "@/components/app/Page";
import { Button, ButtonLink } from "@/components/ui/Button";
import { lessonLabel } from "@/lib/lessons/label";
import type { LessonRow } from "@/lib/lessons/types";
import { BlockRenderer } from "./BlockRenderer";
import { FlagModal } from "./FlagModal";

type PlayerProps = {
  lesson: LessonRow;
  courseId?: string;
  onFinish?: () => void;
};

export function Player({ lesson, courseId, onFinish }: PlayerProps) {
  const [screenIndex, setScreenIndex] = useState(0);
  const [flaggingBlockId, setFlaggingBlockId] = useState<string | null>(null);
  const [flagSuccessToast, setFlagSuccessToast] = useState(false);

  const screens = lesson.spec.screens;
  const currentScreen = screens[screenIndex];
  const isLastScreen = screenIndex === screens.length - 1;
  const isCompleted = screenIndex >= screens.length;

  const handleNext = () => {
    if (isLastScreen) {
      setScreenIndex(screens.length);
      onFinish?.();
    } else {
      setScreenIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrev = () => {
    if (screenIndex > 0) {
      setScreenIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const hasCheckpoint = currentScreen?.blocks.some((b) => b.type === "checkpoint");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6">
      {/* Toast alert on flag */}
      {flagSuccessToast && (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 rounded-[var(--radius-input)] border border-built/30 bg-built-soft px-4 py-3 text-sm font-semibold text-ink"
        >
          Flag sent. A curator will check this block.
        </div>
      )}

      {/* Flag Modal */}
      <FlagModal
        isOpen={Boolean(flaggingBlockId)}
        lessonId={lesson.id}
        blockId={flaggingBlockId}
        onClose={() => setFlaggingBlockId(null)}
        onSuccess={() => {
          setFlagSuccessToast(true);
          setTimeout(() => setFlagSuccessToast(false), 4000);
        }}
      />

      <div className="grid content-start gap-4 lg:gap-6">
        {isCompleted ? (
          <Panel title="Lesson completed">
            <EmptyState
              title={`You've completed ${lesson.spec.title}`}
              body="Review the key takeaways on the right, replay any screen, or head back to your course."
              action={
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setScreenIndex(0)} variant="secondary">
                    Review lesson again
                  </Button>
                  <ButtonLink href={courseId ? `/courses/${courseId}` : "/courses"}>
                    {courseId ? "Back to course" : "Back to courses"}
                  </ButtonLink>
                </div>
              }
            />
          </Panel>
        ) : (
          <Panel
            title={`Screen ${screenIndex + 1} of ${screens.length}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                {hasCheckpoint ? (
                  <span className="rounded-full bg-change-soft px-2.5 py-0.5 text-xs font-semibold text-change">
                    Checkpoint
                  </span>
                ) : null}
                <span
                  className={
                    lesson.trust === "trusted"
                      ? "rounded-full bg-built-soft px-2.5 py-0.5 text-xs font-semibold text-built"
                      : "rounded-full bg-paper px-2.5 py-0.5 text-xs text-ink-2"
                  }
                >
                  {lessonLabel(lesson)}
                </span>
              </div>
            }
          >
            <div className="space-y-4">
              {currentScreen?.blocks
                .filter((b) => !lesson.hidden_blocks.includes(b.id))
                .map((block) => (
                  <BlockRenderer key={block.id} block={block} onFlag={(id) => setFlaggingBlockId(id)} />
                ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={handlePrev} disabled={screenIndex === 0}>
                ← Previous
              </Button>

              <div className="hidden gap-1.5 sm:flex">
                {screens.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScreenIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === screenIndex ? "w-6 bg-change" : idx < screenIndex ? "w-2 bg-built" : "w-2 bg-line"
                    }`}
                    aria-label={`Go to screen ${idx + 1}`}
                  />
                ))}
              </div>

              <Button type="button" variant="primary" onClick={handleNext}>
                {isLastScreen ? "Finish lesson ✓" : "Next screen →"}
              </Button>
            </div>
          </Panel>
        )}
      </div>

      <div className="grid content-start gap-4 lg:gap-6">
        <Panel
          title="Screens"
          action={<span className="text-sm text-ink-2 tabular-nums">~{lesson.spec.est_minutes} min</span>}
        >
          <ol className="grid divide-y divide-line">
            {screens.map((s, idx) => {
              const active = idx === screenIndex && !isCompleted;
              const done = idx < screenIndex || isCompleted;
              const isCheck = s.blocks.some((b) => b.type === "checkpoint");
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setScreenIndex(idx)}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm hover:underline ${
                      active ? "font-semibold text-change" : done ? "text-ink-2" : "text-ink"
                    }`}
                  >
                    <span className="truncate">
                      {idx + 1}. {isCheck ? "Checkpoint" : `Screen ${idx + 1}`}
                    </span>
                    <span className="text-xs text-ink-3 tabular-nums">{done ? "✓" : active ? "Now" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Panel>

        {lesson.spec.summary.length ? (
          <Panel title="Key takeaways">
            <ul className="grid gap-2 text-sm text-ink-2">
              {lesson.spec.summary.map((point, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-built" aria-hidden="true">
                    •
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
