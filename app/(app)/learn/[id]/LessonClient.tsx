"use client";

import { useEffect, useRef } from "react";
import { ActionBar, EmptyState } from "@/components/app/Page";
import { GenerationWaiting } from "@/components/lesson/GenerationWaiting";
import { Player, type LessonLink } from "@/components/lesson/Player";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useJob } from "@/lib/queries/jobs";
import { useConceptLesson, useStartLesson, type LessonState } from "@/lib/queries/lessons";
import { queryKeys } from "@/lib/query/keys";

type LessonClientProps = {
  conceptId: string;
  initialState: LessonState;
  courseId?: string;
  next: LessonLink | null;
  back: LessonLink;
};

export function LessonClient({ conceptId, initialState, courseId, next, back }: LessonClientProps) {
  const { data: state } = useConceptLesson(conceptId, initialState, courseId);
  const start = useStartLesson(conceptId);
  const { mutate } = start;
  const started = useRef(false);
  const queryClient = useQueryClient();

  // Opening a concept with no lesson starts one (F2-FR4). Generation starts only on this POST,
  // never on page load or link prefetch; the worker picks the job up from the queue.
  useEffect(() => {
    if (started.current || state.status !== "none") return;
    started.current = true;
    mutate(courseId);
  }, [state.status, courseId, mutate]);

  // Realtime on the job (owner only) refreshes the moment it finishes; polling covers everyone else.
  const watching =
    state.status === "generating"
      ? state.jobId
      : state.status === "published" && state.notesBuilding
        ? state.notesBuilding.jobId
        : null;
  useJob(watching, {
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.concepts.lesson(conceptId) }),
  });

  if (state.status === "published") {
    return (
      <div className="grid gap-4">
        {state.notesBuilding ? (
          <p role="status" className="rounded-[var(--radius-input)] bg-quantity-soft px-4 py-3 text-base">
            Ifiok is building this lesson from your notes. Start with this one; yours replaces it when it&apos;s ready.
          </p>
        ) : null}
        <Player
          key={state.lesson.id}
          lesson={state.lesson}
          citations={state.fromNotes?.citations}
          next={next}
          back={back}
        />
      </div>
    );
  }

  if (start.isError) {
    return (
      <GenerationWaiting quickExplainer={"quickExplainer" in state ? state.quickExplainer : undefined}>
        <EmptyState title="Your lesson didn't start" body={start.error.message} />
      </GenerationWaiting>
    );
  }

  if (state.status === "none" || state.status === "generating") {
    return <GenerationWaiting building quickExplainer={state.quickExplainer} />;
  }

  if (state.status === "waiting" || state.status === "review") {
    return (
      <GenerationWaiting quickExplainer={state.quickExplainer}>
        <EmptyState
          title={state.status === "waiting" ? "Ready by tomorrow morning" : "Waiting for a curator"}
          body={state.message}
        />
      </GenerationWaiting>
    );
  }

  return (
    <GenerationWaiting quickExplainer={state.quickExplainer}>
      <EmptyState title="This lesson isn't ready" body={state.message} />
      {state.canRetry ? (
        <ActionBar over="screen">
          <Button onClick={() => mutate(courseId)} disabled={start.isPending} aria-busy={start.isPending}>
            Try again
          </Button>
        </ActionBar>
      ) : null}
    </GenerationWaiting>
  );
}
