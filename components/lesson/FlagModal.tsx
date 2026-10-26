"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupRow } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[12px] border border-line bg-surface p-5 text-ink backdrop:bg-ink/40"
    >
      <h2 id="flag-title" className="text-lg font-semibold">
        Flag this block
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        When 3 students flag the same block, it&apos;s hidden until a curator checks it.
      </p>

      {flag.isError ? (
        <p role="alert" className="mt-3 text-base text-bad">
          {flag.error.message}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-base font-semibold">What&apos;s the problem?</legend>
          <RadioGroup
            value={reason}
            onValueChange={(v) => setReason(v as LessonFlagReason)}
            aria-label="What's the problem?"
            className="divide-y divide-line overflow-hidden rounded-[var(--radius-input)] border border-line"
          >
            {REASONS.map((opt) => (
              <RadioGroupRow key={opt.value} value={opt.value} label={opt.label} />
            ))}
          </RadioGroup>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="flag-note">
            What exactly? <span className="font-normal text-ink-2">(optional)</span>
          </Label>
          <Textarea id="flag-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
          <p className="text-sm text-ink-2">Don&apos;t include your name or contact details.</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={flag.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={flag.isPending} aria-busy={flag.isPending}>
            {flag.isPending ? "Sending…" : "Send flag"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
