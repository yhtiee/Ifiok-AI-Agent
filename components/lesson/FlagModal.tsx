"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { LessonFlagReason } from "@/lib/lessons/types";
import { useFlagBlock } from "@/lib/queries/lessons";

type FlagModalProps = {
  isOpen: boolean;
  lessonId: string;
  blockId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

const REASONS: { value: LessonFlagReason; label: string }[] = [
  { value: "wrong", label: "It's wrong (a fact, a number or a step)" },
  { value: "unclear", label: "It's confusing or badly explained" },
  { value: "offensive", label: "It's inappropriate or harmful" },
  { value: "other", label: "Something else" },
];

/** "Flag this" (F2-FR6). Flags from 3 different students hide the block until a curator checks it. */
export function FlagModal({ isOpen, lessonId, blockId, onClose, onSuccess }: FlagModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<LessonFlagReason>("wrong");
  const [note, setNote] = useState("");
  const flag = useFlagBlock(lessonId);
  const { reset } = flag;

  const open = isOpen && Boolean(blockId);

  // Native modal dialog: focus moves inside, Escape closes, the page behind is inert.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      reset();
      setReason("wrong");
      setNote("");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, reset]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!blockId) return;
    flag.mutate(
      { blockId, reason, note: note.trim() || undefined },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      },
    );
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="flag-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-6 text-ink backdrop:bg-ink/50"
    >
      <h2 id="flag-title" className="font-display text-lg font-bold">
        Flag this block
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        When 3 students flag the same block, it&apos;s hidden until a curator checks it.
      </p>

      {flag.isError ? (
        <p role="alert" className="mt-3 rounded-lg border-l-4 border-bad bg-change-soft p-3 text-sm">
          {flag.error.message}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <fieldset>
          <legend className="text-sm font-semibold">What&apos;s the problem?</legend>
          <div className="mt-2 space-y-2">
            {REASONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-base ${
                  reason === opt.value ? "border-change bg-change-soft" : "border-line hover:bg-paper"
                }`}
              >
                <input
                  type="radio"
                  name="flag-reason"
                  value={opt.value}
                  checked={reason === opt.value}
                  onChange={() => setReason(opt.value)}
                  className="accent-[var(--change)]"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="flag-note" className="block text-sm font-semibold">
            What exactly? <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <textarea
            id="flag-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-lg border border-line bg-paper p-3 text-base text-ink placeholder:text-ink-3 focus:border-change focus:outline-hidden"
          />
          <p className="mt-1 text-sm text-ink-3">Don&apos;t include your name or contact details.</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={flag.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={flag.isPending}>
            {flag.isPending ? "Sending flag" : "Send flag"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
