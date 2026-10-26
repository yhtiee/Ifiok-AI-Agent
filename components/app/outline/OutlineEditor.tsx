"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { ActionBar } from "@/components/app/Page";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveOutline } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";

// Outline editor: one row per topic (week, title, optional details). Saving resolves every new
// or renamed topic to a shared concept, so it can take a few seconds (F2-FR2, F2-FR3). Leaving
// with unsaved changes asks first (app-overhaul §5.5).

export type EditorRow = {
  key: string;
  topicId: string | null;
  title: string;
  week: number | null;
  description: string | null;
  lowConfidence: boolean;
};

type Props = {
  courseId: string;
  source: "upload" | "typed" | "ai_draft" | "edit";
  initialRows: EditorRow[];
  note?: string;
  newRow: () => EditorRow;
  onCancel: () => void;
  onSaved: (status: "applied" | "pending") => void;
};

const iconButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-input)] text-ink-2 hover:bg-paper hover:text-ink disabled:opacity-30";

const snapshot = (rows: EditorRow[]) =>
  JSON.stringify(rows.map((r) => [r.topicId, r.title.trim(), r.week, r.description?.trim() || null]));

export function OutlineEditor({ courseId, source, initialRows, note, newRow, onCancel, onSaved }: Props) {
  const [rows, setRows] = useState<EditorRow[]>(initialRows);
  const [initial] = useState(() => snapshot(initialRows));
  const [error, setError] = useState<string | null>(null);
  const [broad, setBroad] = useState<Record<string, string[]>>({});
  const save = useSaveOutline(courseId);
  // Read, uploaded and drafted outlines haven't been saved yet: leaving them loses the work too.
  const dirty = source !== "edit" || snapshot(rows) !== initial;

  const update = (key: string, patch: Partial<EditorRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, lowConfidence: false } : r)));
  const move = (index: number, by: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item!);
      return next;
    });

  const onSave = () => {
    setError(null);
    const kept = rows.filter((r) => r.title.trim());
    if (!kept.length) {
      setError("Add at least one topic.");
      return;
    }
    save.mutate(
      {
        source,
        topics: kept.map((r) => ({
          topic_id: r.topicId,
          title: r.title.trim(),
          week: r.week,
          description: r.description?.trim() || null,
        })),
      },
      {
        onSuccess: (result) => {
          if (result.status === "too_broad") {
            const byKey: Record<string, string[]> = {};
            for (const t of result.topics) {
              const target = kept[t.index];
              if (target) byKey[target.key] = t.suggestions;
            }
            setBroad(byKey);
            setError("Some topics are whole subjects. Pick a narrower topic for each marked row.");
            return;
          }
          onSaved(result.status);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save the outline. Try again."),
      },
    );
  };

  return (
    <div className="grid gap-4">
      {note ? (
        <p className="flex flex-wrap items-center gap-2 rounded-[var(--radius-input)] border border-dashed border-change px-4 py-3 text-base">
          {source === "ai_draft" ? <Badge variant="draft">Draft</Badge> : null}
          {note}
        </p>
      ) : null}

      <ol className="grid gap-3" aria-label="Topics">
        {rows.map((r, i) => (
          <li
            key={r.key}
            className={`grid gap-2 rounded-[var(--radius-input)] border bg-surface p-3 ${
              broad[r.key] ? "border-warn" : r.lowConfidence ? "border-warn/60" : "border-line"
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="grid w-16 shrink-0 gap-1">
                <label htmlFor={`${r.key}-week`} className="text-xs text-ink-2">
                  Week
                </label>
                <Input
                  id={`${r.key}-week`}
                  inputMode="numeric"
                  value={r.week ?? ""}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, "").slice(0, 2));
                    update(r.key, { week: n >= 1 && n <= 30 ? n : null });
                  }}
                  className="min-h-11 px-2 tabular-nums"
                />
              </div>
              <div className="grid min-w-0 flex-1 gap-1">
                <label htmlFor={`${r.key}-title`} className="text-xs text-ink-2">
                  Topic {i + 1}
                </label>
                <Input
                  id={`${r.key}-title`}
                  value={r.title}
                  onChange={(e) => {
                    update(r.key, { title: e.target.value });
                    setBroad(({ [r.key]: _drop, ...rest }) => rest);
                  }}
                  placeholder="For example, Limits and continuity"
                  maxLength={120}
                  className="min-h-11"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={r.description ?? ""}
                onChange={(e) => update(r.key, { description: e.target.value })}
                placeholder="Details (optional)"
                maxLength={400}
                aria-label={`Details for topic ${i + 1}`}
                className="min-h-11 flex-1 text-sm"
              />
              <div className="flex shrink-0">
                <button
                  type="button"
                  className={iconButton}
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move topic ${i + 1} up`}
                >
                  <ArrowUpIcon size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label={`Move topic ${i + 1} down`}
                >
                  <ArrowDownIcon size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  aria-label={`Remove topic ${i + 1}`}
                >
                  <TrashIcon size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            {r.lowConfidence ? (
              <p className="flex items-center gap-1.5 text-sm text-warn">
                <WarningIcon size={16} aria-hidden="true" /> Check this one: it was hard to read.
              </p>
            ) : null}
            {broad[r.key] ? (
              <div className="grid gap-2">
                <p className="flex items-center gap-1.5 text-sm text-warn">
                  <WarningIcon size={16} aria-hidden="true" /> This is a whole subject. Pick a narrower topic:
                </p>
                <ul className="flex flex-wrap gap-2">
                  {broad[r.key]!.map((s) => (
                    <li key={s}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          update(r.key, { title: s });
                          setBroad(({ [r.key]: _drop, ...rest }) => rest);
                        }}
                      >
                        {s}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <Button
        variant="outline"
        className="justify-self-start"
        onClick={() => setRows((rs) => [...rs, { ...newRow(), week: (rs.at(-1)?.week ?? rs.length) + 1 }])}
        disabled={rows.length >= 60}
      >
        <PlusIcon size={18} aria-hidden="true" /> Add topic
      </Button>

      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}

      <ActionBar>
        {dirty ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={save.isPending} className="lg:order-2">
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
              <AlertDialogDescription>The outline stays as it was before you started.</AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onCancel}>
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button variant="outline" onClick={onCancel} disabled={save.isPending} className="lg:order-2">
            Cancel
          </Button>
        )}
        <Button onClick={onSave} disabled={save.isPending} aria-busy={save.isPending}>
          {save.isPending ? "Saving and matching topics…" : "Save outline"}
        </Button>
      </ActionBar>
    </div>
  );
}
