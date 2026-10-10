"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Panel } from "@/components/app/Page";
import { Button, SubmitButton } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { useCreateCourse, useJoinCourse, type CourseSummary } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";

const LEVELS = [100, 200, 300, 400, 500, 600, 700];

type Props = {
  subjects: { code: string; title: string }[];
  defaultLevel: number | null;
  initialCode: string;
  initialTitle: string;
};

export function CreateCourseForm({ subjects, defaultLevel, initialCode, initialTitle }: Props) {
  const router = useRouter();
  const create = useCreateCourse();
  const join = useJoinCourse();
  const [form, setForm] = useState({
    code: initialCode,
    title: initialTitle,
    subject: "",
    level: defaultLevel ? String(defaultLevel) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<CourseSummary[] | null>(null);
  const [existing, setExisting] = useState<CourseSummary | null>(null);

  const submit = (confirmNew = false) => {
    setError(null);
    create.mutate(
      {
        code: form.code,
        title: form.title,
        subject: form.subject,
        level: form.level ? Number(form.level) : null,
        confirmNew,
      },
      {
        onSuccess: (result) => {
          if (result.status === "created") router.push(`/courses/${result.course.id}`);
          else if (result.status === "exists") setExisting(result.course);
          else setSimilar(result.candidates);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't add the course. Try again."),
      },
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.title.trim() || !form.subject) {
      setError("Fill in the code, title and subject.");
      return;
    }
    submit(false);
  };

  const joinAndOpen = (course: CourseSummary) =>
    join.mutate(course.id, { onSuccess: () => router.push(`/courses/${course.id}`) });

  if (existing || similar) {
    const list = existing ? [existing] : (similar ?? []);
    return (
      <Panel title={existing ? `${existing.code} is already on Ifiok` : "Is it one of these?"}>
        <p className="mb-4 max-w-[60ch] text-base text-ink-2">
          {existing
            ? "A classmate has added this course. Join it to share its outline and lessons."
            : "These courses at your university look similar. Join one if it's yours, so your class shares one outline."}
        </p>
        <ul className="grid divide-y divide-line">
          {list.map((c) => (
            <li key={c.id} className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-3">
              <span className="grid gap-0.5">
                <span className="text-base font-semibold">
                  {c.code} · {c.title}
                </span>
                <span className="text-sm text-ink-2">
                  {c.members} {c.members === 1 ? "classmate" : "classmates"}
                </span>
              </span>
              <Button variant="secondary" onClick={() => joinAndOpen(c)} disabled={join.isPending}>
                {join.isPending && join.variables === c.id ? "Joining…" : "Join this course"}
              </Button>
            </li>
          ))}
        </ul>
        {similar ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button onClick={() => submit(true)} disabled={create.isPending}>
              {create.isPending ? "Adding…" : `None of these: add ${form.code.toUpperCase()}`}
            </Button>
            <Button variant="quiet" onClick={() => setSimilar(null)}>
              Change the details
            </Button>
          </div>
        ) : (
          <Button className="mt-4" variant="quiet" onClick={() => setExisting(null)}>
            Back
          </Button>
        )}
      </Panel>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid max-w-2xl gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
        <TextField
          label="Course code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="MTH 101"
          autoCapitalize="characters"
          autoComplete="off"
          hint="As on your timetable"
        />
        <TextField
          label="Course title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Elementary Mathematics I"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Subject"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        >
          <option value="">Choose a subject</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.title}
            </option>
          ))}
        </SelectField>
        <SelectField label="Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
          <option value="">Not sure</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l === 700 ? "Postgraduate" : `${l} level`}
            </option>
          ))}
        </SelectField>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      <div className="sm:max-w-xs">
        <SubmitButton pending={create.isPending} pendingLabel="Checking…">
          Add course
        </SubmitButton>
      </div>
    </form>
  );
}
