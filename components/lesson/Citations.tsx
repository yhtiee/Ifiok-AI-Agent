"use client";

import { createContext, useContext } from "react";

// Citations in a private lesson (10 MVP-02): "From your notes, p. 12" per cited chunk. Shared
// lessons have no labels here; their quotes say "Approved course material".

const CitationContext = createContext<Record<string, string>>({});

export const CitationProvider = CitationContext.Provider;

export function useCitation(chunkId: number): string | undefined {
  return useContext(CitationContext)[String(chunkId)];
}

/** One quiet line under a block listing where it comes from in the student's materials. */
export function CitationLine({ refs }: { refs: number[] | undefined }) {
  const labels = useContext(CitationContext);
  const shown = [...new Set((refs ?? []).map((r) => labels[String(r)]).filter((l): l is string => Boolean(l)))];
  if (shown.length === 0) return null;
  return <p className="-mt-2 text-sm text-ink-2">{shown.join(" · ")}</p>;
}
