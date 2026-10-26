"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import { postSync, type AttemptInput } from "@/lib/queries/practice";
import { queryKeys } from "@/lib/query/keys";

// Lesson evidence (10 MVP-03, guardrail 6): each checkpoint's first answer and each finished
// screen go to /api/sync, which re-marks and records them. The on-screen feedback stays instant;
// sending is in the background and a failure never interrupts the lesson. A retry after seeing the
// answer is not sent, so it can't count as a fresh correct answer.

type Evidence = {
  answer: (blockId: string, response: AttemptInput["response"]) => void;
  screenDone: (screenId: string) => void;
};

const NOOP: Evidence = { answer: () => {}, screenDone: () => {} };
const EvidenceContext = createContext<Evidence>(NOOP);

export function EvidenceProvider({ lessonId, children }: { lessonId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const answered = useRef(new Set<string>());
  const screens = useRef(new Set<string>());

  const send = useCallback(
    (body: Parameters<typeof postSync>[0]) =>
      postSync(body)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.practice.all() });
          void queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
        })
        .catch(() => {
          // Offline or the server is busy: the lesson carries on. Offline sync arrives with L-05.
        }),
    [queryClient],
  );

  const value = useMemo<Evidence>(
    () => ({
      answer(blockId, response) {
        if (answered.current.has(blockId)) return;
        answered.current.add(blockId);
        void send({ attempts: [{ id: crypto.randomUUID(), lesson_id: lessonId, block_id: blockId, response }] });
      },
      screenDone(screenId) {
        if (screens.current.has(screenId)) return;
        screens.current.add(screenId);
        void send({
          screens: [
            {
              id: crypto.randomUUID(),
              lesson_id: lessonId,
              screen_id: screenId,
              completed_at: new Date().toISOString(),
            },
          ],
        });
      },
    }),
    [lessonId, send],
  );

  return <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>;
}

export function useEvidence() {
  return useContext(EvidenceContext);
}
