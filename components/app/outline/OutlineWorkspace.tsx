"use client";

import { LockSimpleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionBar } from "@/components/app/Page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSaveOutline } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";
import { OutlineEditor } from "./OutlineEditor";
import { OutlineHistory, type Revision } from "./OutlineHistory";
import { OutlineSetup } from "./OutlineSetup";
import { clearEdit, newRow, pendingEdit, typedMode, type EditMode, type EditSource } from "./outline-modes";

// The outline page (/courses/[id]/outline, app-overhaul §5.5): one job, get the outline right.
// Set it up three ways, check a draft, edit it wiki-style, upload a new version, and see its
// history. Saving lands back on the course page with a toast.

type Topic = { id: string; title: string; week: number | null; description: string | null };

type Props = {
  courseId: string;
  locked: boolean;
  isDraft: boolean;
  topics: Topic[];
  revisions: Revision[];
  /** ?start= from the course page's Set up block. */
  start: "upload" | "typed" | "draft" | null;
};

export function OutlineWorkspace({ courseId, locked, isDraft, topics, revisions, start }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<EditMode | null>(() =>
    locked ? null : (pendingEdit(courseId) ?? (start === "typed" ? typedMode() : null)),
  );
  const [picking, setPicking] = useState(false);
  const save = useSaveOutline(courseId);

  // The hand-off from the course page is used once.
  useEffect(() => () => clearEdit(courseId), [courseId]);

  const leaveEditor = () => {
    clearEdit(courseId);
    setMode(null);
  };

  const startEdit = () =>
    setMode({
      kind: "edit",
      source: "edit" as EditSource,
      rows: topics.map((t) => newRow({ topicId: t.id, title: t.title, week: t.week, description: t.description })),
    });

  const confirmDraft = () =>
    save.mutate(
      {
        source: "edit",
        topics: topics.map((t) => ({ topic_id: t.id, title: t.title, week: t.week, description: t.description })),
      },
      {
        onSuccess: (r) => {
          toast(r.status === "pending" ? "Thanks. Another member will confirm it." : "Outline confirmed.");
          router.refresh();
        },
        onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't save the outline. Try again."),
      },
    );

  if (mode) {
    return (
      <OutlineEditor
        courseId={courseId}
        source={mode.source}
        initialRows={mode.rows}
        note={mode.note}
        newRow={() => newRow()}
        onCancel={leaveEditor}
        onSaved={(status) => {
          clearEdit(courseId);
          toast(status === "pending" ? "Saved. It goes live once another member confirms it." : "Outline saved.");
          router.push(`/courses/${courseId}`);
        }}
      />
    );
  }

  const history = <OutlineHistory courseId={courseId} revisions={revisions} />;

  if (!topics.length) {
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        {locked ? <LockedNote /> : <OutlineSetup courseId={courseId} onReady={setMode} />}
        {history}
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="grid content-start gap-6">
        {locked ? <LockedNote /> : null}
        {isDraft ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-input)] border border-dashed border-change px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-2 text-base">
              <Badge variant="draft">Draft</Badge> Check it against your course.
            </p>
            {locked || picking ? null : (
              <ActionBar>
                <Button onClick={confirmDraft} disabled={save.isPending} aria-busy={save.isPending}>
                  {save.isPending ? "Saving…" : "It matches my course"}
                </Button>
              </ActionBar>
            )}
          </div>
        ) : null}

        <ol className="divide-y divide-line border-y border-line" aria-label="Topics in the outline">
          {topics.map((t, i) => (
            <li key={t.id} className="grid grid-cols-[3.25rem_1fr] gap-3 py-3">
              <span className="pt-0.5 text-sm text-ink-2 tabular-nums">{t.week ? `Wk ${t.week}` : `#${i + 1}`}</span>
              <span className="grid min-w-0 gap-0.5">
                <span className="text-base font-semibold [overflow-wrap:anywhere]">{t.title}</span>
                {t.description ? <span className="text-sm text-ink-2">{t.description}</span> : null}
              </span>
            </li>
          ))}
        </ol>

        {locked ? null : (
          <div className="grid gap-4">
            {isDraft || picking ? (
              <Button variant="outline" className="justify-self-start" onClick={startEdit}>
                Edit outline
              </Button>
            ) : (
              <ActionBar>
                <Button onClick={startEdit}>Edit outline</Button>
              </ActionBar>
            )}
            <OutlineSetup courseId={courseId} uploadOnly onReady={setMode} onPickingChange={setPicking} />
          </div>
        )}
      </div>
      {history}
    </div>
  );
}

function LockedNote() {
  return (
    <p className="flex items-center gap-2 text-base text-ink-2">
      <LockSimpleIcon size={20} aria-hidden="true" /> Outline locked by your lecturer.
    </p>
  );
}
