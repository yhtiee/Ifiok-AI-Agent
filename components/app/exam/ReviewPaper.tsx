"use client";

import { TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionBar, EmptyState } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSavePaper, type ReviewedQuestion } from "@/lib/queries/exam";
import { ApiError } from "@/lib/query/api";
import { cn } from "@/lib/utils";

// Review the questions Ifiok read from a past paper before they're saved (F8-FR1, 04 §4.6: a human
// always confirms an extraction). Fix text, marks, type and topic, or remove a question. Saved
// questions help classmates in the course (12 §4 Q53); the file and notes stay private.

type DraftRow = ReviewedQuestion & { key: string; confidence: number; concept_confidence: number };

export type ReviewProps = {
  courseId: string;
  courseCode: string;
  sourceId: string;
  title: string;
  status: string;
  draft: {
    year: number | null;
    instructions: string | null;
    questions: (ReviewedQuestion & { confidence: number; concept_confidence: number })[];
  } | null;
  topics: { conceptId: string; title: string }[];
};

const QTYPE_LABELS: Record<ReviewedQuestion["qtype"], string> = {
  calc: "Calculation",
  theory: "Explain or discuss",
  definition: "Definition",
  proof: "Proof",
  diagram: "Diagram",
  mcq: "Multiple choice",
};

export function ReviewPaper(props: ReviewProps) {
  const router = useRouter();
  const save = useSavePaper(props.courseId);
  const [year, setYear] = useState(props.draft?.year ? String(props.draft.year) : "");
  const [rows, setRows] = useState<DraftRow[]>(
    () => props.draft?.questions.map((q, i) => ({ ...q, key: `q${i}` })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  // Still reading: check back every few seconds.
  const reading = !props.draft && props.status !== "failed";
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [reading, router]);

  if (!props.draft) {
    return props.status === "failed" ? (
      <EmptyState
        title="Ifiok couldn't read questions from these pages"
        body="Check the pages have the questions as text (scanned pages can't be read yet), then add them again."
      />
    ) : (
      <div className="grid gap-2" aria-busy="true">
        <p className="text-base">Reading the questions from {props.title}… about a minute.</p>
        <div className="h-24 rounded-[var(--radius-input)] bg-line/60" />
        <div className="h-24 rounded-[var(--radius-input)] bg-line/60" />
      </div>
    );
  }

  const update = (key: string, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const unassigned = rows.filter((r) => !r.concept_id).length;

  const submit = () => {
    setError(null);
    const y = year.trim() ? Number(year) : null;
    if (y !== null && (!Number.isInteger(y) || y < 1950 || y > 2100))
      return setError("Enter the paper's year, like 2024.");
    if (rows.some((r) => r.text.trim().length < 3)) return setError("Each question needs its text, or remove it.");
    save.mutate(
      {
        source_id: props.sourceId,
        year: y,
        questions: rows.map(({ number, sub, text, marks, qtype, concept_id }) => ({
          number: number.trim() || "?",
          sub: sub?.trim() || null,
          text: text.trim(),
          marks,
          qtype,
          concept_id,
        })),
      },
      {
        onSuccess: (r) => {
          toast(`Saved ${r.saved} questions${r.unassigned ? `, ${r.unassigned} without a topic` : ""}.`);
          router.push(`/courses/${props.courseId}?tab=exam`);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "That didn't save. Try again."),
      },
    );
  };

  return (
    <div className="grid max-w-4xl gap-6">
      <p className="rounded-[var(--radius-input)] border border-line bg-paper px-4 py-3 text-base">
        These questions will help your classmates in {props.courseCode}: they&apos;ll see the questions and which topics
        they test. Your file and notes stay private.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label htmlFor="paper-year" className="grid gap-1.5">
          <span className="text-base font-semibold">Year of the paper</span>
          <Input
            id="paper-year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-32"
            placeholder="2024"
          />
        </label>
        {props.draft.instructions ? (
          <p className="text-sm text-ink-2">Paper instructions: {props.draft.instructions}</p>
        ) : null}
      </div>
      <p className="text-sm text-ink-2">
        {rows.length} {rows.length === 1 ? "question" : "questions"}
        {unassigned ? ` · ${unassigned} without a topic (they're saved, but don't count towards a topic)` : ""}
      </p>

      <ol className="grid gap-4">
        {rows.map((r, i) => (
          <li key={r.key} className="grid gap-3 rounded-[var(--radius-input)] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label htmlFor={`${r.key}-number`} className="grid gap-1">
                <span className="text-sm font-semibold">Question</span>
                <Input
                  id={`${r.key}-number`}
                  value={r.number + (r.sub ?? "")}
                  onChange={(e) => update(r.key, { number: e.target.value, sub: null })}
                  className="w-24"
                  aria-label={`Question ${i + 1} number`}
                />
              </label>
              <label htmlFor={`${r.key}-marks`} className="grid gap-1">
                <span className="text-sm font-semibold">Marks</span>
                <Input
                  id={`${r.key}-marks`}
                  inputMode="decimal"
                  value={r.marks ?? ""}
                  onChange={(e) => update(r.key, { marks: e.target.value.trim() ? Number(e.target.value) || 0 : null })}
                  className="w-20"
                  aria-label={`Question ${i + 1} marks`}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Type</span>
                <select
                  value={r.qtype}
                  onChange={(e) => update(r.key, { qtype: e.target.value as ReviewedQuestion["qtype"] })}
                  className={cn(fieldClass, "w-48")}
                  aria-label={`Question ${i + 1} type`}
                >
                  {Object.entries(QTYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-48 flex-1 gap-1">
                <span className="text-sm font-semibold">Topic</span>
                <select
                  value={r.concept_id ?? ""}
                  onChange={(e) => update(r.key, { concept_id: e.target.value || null })}
                  className={cn(fieldClass, !r.concept_id && "border-change")}
                  aria-label={`Question ${i + 1} topic`}
                >
                  <option value="">No topic (unassigned)</option>
                  {props.topics.map((t) => (
                    <option key={t.conceptId} value={t.conceptId}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                aria-label={`Remove question ${i + 1}`}
              >
                <TrashIcon size={20} aria-hidden="true" />
              </Button>
            </div>
            <Textarea
              value={r.text}
              onChange={(e) => update(r.key, { text: e.target.value })}
              rows={Math.min(8, Math.max(2, Math.ceil(r.text.length / 90)))}
              aria-label={`Question ${i + 1} text`}
            />
            {r.confidence < 0.6 ? (
              <p className="text-sm text-change">
                Ifiok wasn&apos;t sure it read this one correctly. Check it against the paper.
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
      <ActionBar>
        <Button onClick={submit} disabled={!rows.length || save.isPending} aria-busy={save.isPending}>
          {save.isPending ? "Saving…" : `Save ${rows.length} ${rows.length === 1 ? "question" : "questions"}`}
        </Button>
      </ActionBar>
    </div>
  );
}
