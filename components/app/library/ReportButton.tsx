"use client";

import { useState } from "react";
import { z } from "zod/mini";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/lib/query/api";

// Report a Library document (08 §7): a short reason; 3 reports from different students send it back
// to an admin.

export function ReportButton({ endpoint }: { endpoint: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") return <p className="text-sm text-ink-2">Reported. Thanks: an admin will look at it.</p>;
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-self-start text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        Report
      </button>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (reason.trim().length < 3) return;
        setState("sending");
        setError(null);
        try {
          await apiFetch(endpoint, {
            method: "POST",
            body: { reason: reason.trim() },
            schema: z.object({ reported: z.boolean() }),
          });
          setState("sent");
        } catch (err) {
          setState("idle");
          setError(err instanceof ApiError ? err.message : "The report didn't send. Try again.");
        }
      }}
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        placeholder="What's wrong with it?"
        aria-label="What's wrong with it?"
        className="min-h-11 flex-1 rounded-[var(--radius-input)] border border-line bg-surface px-3 text-base"
      />
      <Button type="submit" variant="outline" size="sm" disabled={reason.trim().length < 3 || state === "sending"}>
        Send report
      </Button>
      {error ? (
        <p role="alert" className="w-full text-sm text-bad">
          {error}
        </p>
      ) : null}
    </form>
  );
}
