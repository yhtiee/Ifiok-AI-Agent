"use client";

import { useState } from "react";
import type { BlockOf } from "./types";

export function FlashcardsBlock({ block }: { block: BlockOf<"flashcards"> }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = block.cards[index];
  if (!card) return null;

  const go = (next: number) => {
    setIndex(next);
    setFlipped(false);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show the front of the card" : "Show the back of the card"}
        className="flex min-h-28 w-full flex-col justify-center rounded-lg border border-line bg-paper p-5 text-center"
      >
        <span className="mb-1 text-sm text-ink-3">
          Card {index + 1} of {block.cards.length} · {flipped ? "back" : "front, tap to turn over"}
        </span>
        <span className="text-base font-semibold text-ink">{flipped ? card.back : card.front}</span>
      </button>
      {block.cards.length > 1 ? (
        <div className="flex justify-between">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            className="min-h-11 text-sm font-semibold text-quantity disabled:text-ink-3"
          >
            Previous card
          </button>
          <button
            type="button"
            disabled={index === block.cards.length - 1}
            onClick={() => go(index + 1)}
            className="min-h-11 text-sm font-semibold text-quantity disabled:text-ink-3"
          >
            Next card
          </button>
        </div>
      ) : null}
    </div>
  );
}
