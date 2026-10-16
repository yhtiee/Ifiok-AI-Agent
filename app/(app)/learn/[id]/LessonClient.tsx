"use client";

import { useEffect, useRef } from "react";
import { EmptyState } from "@/components/app/Page";
import { GenerationWaiting } from "@/components/lesson/GenerationWaiting";
import { Player } from "@/components/lesson/Player";
import { Button } from "@/components/ui/Button";
import { useQueryClient } from "@tanstack/react-query";
import { useJob } from "@/lib/queries/jobs";
import { useConceptLesson, useStartLesson, type LessonState } from "@/lib/queries/lessons";
import { queryKeys } from "@/lib/query/keys";

type LessonClientProps = {
  conceptId: string;
  initialState: LessonState;
  courseId?: string;
};

export function LessonClient({ conceptId, initialState, courseId }: LessonClientProps) {
  const { data: state } = useConceptLesson(conceptId, initialState);
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
  useJob(state.status === "generating" ? state.jobId : null, {
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.concepts.lesson(conceptId) }),
  });

  if (state.status === "published") {
    return <Player lesson={state.lesson} courseId={courseId} />;
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
      <EmptyState
        title="This lesson isn't ready"
        body={state.message}
        action={
          state.canRetry ? (
            <Button variant="primary" onClick={() => mutate(courseId)} disabled={start.isPending}>
              Try again
            </Button>
          ) : undefined
        }
      />
    </GenerationWaiting>
  );
}
