"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@/components/app/Page";
import { useDecideRevision } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";

// Outline history (F2-FR2 wiki-style edits, 08 §2.5b): who changed what, pending edits waiting
// for another member, and one-tap restore of an earlier version.

type Revision = {
  id: number;
  source: string;
  status: string;
  createdAt: string;
  editor: string;
  isMine: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  upload: "added it from a photo",
  typed: "typed the outline",
  ai_draft: "added a draft",
  edit: "edited the outline",
  revert: "restored a version",
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function OutlineHistory({ courseId, revisions }: { courseId: string; revisions: Revision[] }) {
  const router = useRouter();
  const decide = useDecideRevision(courseId);
  const [message, setMessage] = useState<string | null>(null);
  const latestApplied = revisions.find((r) => r.status === "applied")?.id;

  const act = (revisionId: number, action: "confirm" | "reject" | "revert") => {
    setMessage(null);
    decide.mutate(
      { revisionId, action },
      {
        onSuccess: (r) => {
          setMessage(
            action === "revert"
              ? r.status === "pending"
                ? "Restore saved. Another member will confirm it."
                : "Earlier version restored."
              : action === "confirm"
                ? "Edit confirmed and applied."
                : "Edit rejected.",
          );
          router.refresh();
        },
        onError: (err) => setMessage(err instanceof ApiError ? err.message : "That didn't work. Try again."),
      },
    );
  };

  return (
    <Panel title="Outline history">
      {message ? (
        <p role="status" className="mb-3 text-sm">
          {message}
        </p>
      ) : null}
      {revisions.length ? (
        <ol className="grid divide-y divide-line">
          {revisions.map((r) => {
            const busy = decide.isPending && decide.variables?.revisionId === r.id;
            return (
              <li key={r.id} className="grid gap-1 py-3">
                <p className="text-sm">
                  <span className="font-semibold">{r.editor}</span> {SOURCE_LABEL[r.source] ?? "changed the outline"}
                </p>
                <p className="text-xs text-ink-2">
                  {when(r.createdAt)}
                  {r.status === "pending"
                    ? " · Waiting for a member to confirm"
                    : r.status === "rejected"
                      ? " · Rejected"
                      : null}
                  {r.id === latestApplied ? " · Current version" : null}
                </p>
                {r.status === "pending" && !r.isMine ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(r.id, "confirm")}
                      className="min-h-11 px-2 text-sm font-semibold text-quantity hover:underline disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(r.id, "reject")}
                      className="min-h-11 px-2 text-sm text-ink-2 hover:underline disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
                {r.status === "applied" && r.id !== latestApplied ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(r.id, "revert")}
                    className="min-h-11 justify-self-start px-2 text-sm font-semibold text-quantity hover:underline disabled:opacity-60"
                  >
                    {busy ? "Restoring…" : "Restore this version"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-base text-ink-2">Changes to the outline appear here, so anything can be undone.</p>
      )}
    </Panel>
  );
}
