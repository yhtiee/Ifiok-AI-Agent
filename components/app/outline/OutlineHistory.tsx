"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDecideRevision } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";
import { cn } from "@/lib/utils";

// Outline history (F2-FR2 wiki-style edits, 08 §2.5b, app-overhaul §5.5): who changed what,
// pending edits waiting for another member, and restoring an earlier version (asked first).
// Phones show the latest few here and the rest in a bottom sheet.

export type Revision = {
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

const PHONE_ROWS = 3;

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
  const latestApplied = revisions.find((r) => r.status === "applied")?.id;

  const act = (revisionId: number, action: "confirm" | "reject" | "revert") => {
    decide.mutate(
      { revisionId, action },
      {
        onSuccess: (r) => {
          toast(
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
        onError: (err) => toast(err instanceof ApiError ? err.message : "That didn't work. Try again."),
      },
    );
  };

  // `clip`: on phones only the first few rows show; the sheet lists them all.
  const list = (clip: boolean) => (
    <ol className="divide-y divide-line border-y border-line" aria-label="Changes to the outline">
      {revisions.map((r, i) => (
        <RevisionRow
          key={r.id}
          className={clip && i >= PHONE_ROWS ? "max-lg:hidden" : undefined}
          revision={r}
          current={r.id === latestApplied}
          busy={decide.isPending && decide.variables?.revisionId === r.id}
          onAct={(action) => act(r.id, action)}
        />
      ))}
    </ol>
  );

  return (
    <section id="history" aria-labelledby="history-title" className="grid scroll-mt-20 content-start gap-3">
      <h2 id="history-title" className="text-base font-semibold">
        History
      </h2>
      {revisions.length ? (
        <>
          {list(true)}
          {revisions.length > PHONE_ROWS ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" className="justify-self-start lg:hidden">
                  See all {revisions.length} changes
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetTitle>Outline history</SheetTitle>
                <SheetDescription>Every change, newest first. Anything can be undone.</SheetDescription>
                {list(false)}
              </SheetContent>
            </Sheet>
          ) : null}
        </>
      ) : (
        <p className="text-base text-ink-2">Changes to the outline appear here, so anything can be undone.</p>
      )}
    </section>
  );
}

function RevisionRow(props: {
  className?: string;
  revision: Revision;
  current: boolean;
  busy: boolean;
  onAct: (action: "confirm" | "reject" | "revert") => void;
}) {
  const { revision: r, current, busy, onAct } = props;
  return (
    <li className={cn("grid gap-2 py-3", props.className)}>
      <div className="grid gap-0.5">
        <p className="text-base">
          <span className="font-semibold">{r.editor}</span> {SOURCE_LABEL[r.source] ?? "changed the outline"}
        </p>
        <p className="text-sm text-ink-2">
          {when(r.createdAt)}
          {r.status === "pending"
            ? " · Waiting for a member to confirm"
            : r.status === "rejected"
              ? " · Rejected"
              : null}
          {current ? " · Current version" : null}
        </p>
      </div>
      {r.status === "pending" && !r.isMine ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} aria-busy={busy} onClick={() => onAct("confirm")}>
            Confirm
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onAct("reject")}>
            Reject
          </Button>
        </div>
      ) : null}
      {r.status === "applied" && !current ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="justify-self-start" disabled={busy} aria-busy={busy}>
              {busy ? "Restoring…" : "Restore"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>Everyone in the course will see it.</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep the current one</AlertDialogCancel>
              <AlertDialogAction onClick={() => onAct("revert")}>Restore</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </li>
  );
}
