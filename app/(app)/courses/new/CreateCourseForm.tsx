"use client";

import { BooksIcon } from "@phosphor-icons/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/mini";
import { ActionBar, Row, RowList } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useCreateCourse, useJoinCourse, type CourseSummary } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";

// Add a course (app-overhaul §5.3). The server checks everything again (createCourseInput) and
// offers an existing or similar course before making a duplicate.

const LEVELS = [100, 200, 300, 400, 500, 600, 700];
const NOT_SURE = "none";

const schema = z.object({
  code: z
    .string()
    .check(
      z.trim(),
      z.minLength(2, "Enter the course code, like MTH 101."),
      z.maxLength(12, "Keep the code to 12 characters or fewer."),
    ),
  title: z
    .string()
    .check(
      z.trim(),
      z.minLength(3, "Enter the course title, as on your timetable."),
      z.maxLength(120, "Keep the title to 120 characters or fewer."),
    ),
  subject: z.string().check(z.minLength(1, "Choose the subject.")),
  level: z.string(),
});
type Values = z.infer<typeof schema>;

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
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<{ kind: "exists" | "similar"; courses: CourseSummary[] } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initialCode,
      title: initialTitle,
      subject: "",
      level: defaultLevel ? String(defaultLevel) : NOT_SURE,
    },
  });

  const submit = (values: Values, confirmNew = false) => {
    setError(null);
    create.mutate(
      {
        code: values.code,
        title: values.title,
        subject: values.subject,
        level: values.level === NOT_SURE ? null : Number(values.level),
        confirmNew,
      },
      {
        onSuccess: (result) => {
          if (result.status === "created") router.push(`/courses/${result.course.id}`);
          else if (result.status === "exists") setMatch({ kind: "exists", courses: [result.course] });
          else setMatch({ kind: "similar", courses: result.candidates });
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't add the course. Try again."),
      },
    );
  };

  const joinAndOpen = (course: CourseSummary) =>
    join.mutate(course.id, {
      onSuccess: () => router.push(`/courses/${course.id}`),
      onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't join the course. Try again."),
    });

  if (match) {
    const code = form.getValues("code").trim().toUpperCase();
    const exists = match.kind === "exists";
    return (
      <section aria-labelledby="match-title" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="match-title" className="text-lg font-semibold">
            {exists ? `${match.courses[0]!.code} is already on Ifiok` : "Is it one of these?"}
          </h2>
          <p className="max-w-[60ch] text-base text-ink-2">
            {exists
              ? "A classmate has added this course. Join it to share its outline and lessons."
              : "These courses at your university look similar. Join one if it's yours, so your class shares one outline."}
          </p>
        </div>
        <RowList label={exists ? "Existing course" : "Similar courses"}>
          {match.courses.map((c) => {
            const busy = join.isPending && join.variables === c.id;
            return (
              <Row
                key={c.id}
                icon={<BooksIcon size={22} />}
                tone="course"
                title={`${c.code} · ${c.title}`}
                meta={`${c.members} ${c.members === 1 ? "classmate" : "classmates"}`}
                trailing={
                  <Button
                    variant={exists ? "default" : "outline"}
                    size="sm"
                    onClick={() => joinAndOpen(c)}
                    disabled={join.isPending}
                    aria-busy={busy}
                  >
                    {busy ? "Joining…" : "Join this course"}
                  </Button>
                }
              />
            );
          })}
        </RowList>
        {error ? (
          <p role="alert" className="text-base text-bad">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {exists ? null : (
            <ActionBar>
              <Button
                onClick={() => submit(form.getValues(), true)}
                disabled={create.isPending}
                aria-busy={create.isPending}
              >
                {create.isPending ? "Adding…" : `None of these: add ${code}`}
              </Button>
            </ActionBar>
          )}
          <Button variant="ghost" onClick={() => setMatch(null)}>
            Change the details
          </Button>
        </div>
      </section>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => submit(v))} noValidate className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course code</FormLabel>
                <FormControl>
                  <Input placeholder="MTH 101" autoCapitalize="characters" autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>As on your timetable</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course title</FormLabel>
                <FormControl>
                  <Input placeholder="Elementary Mathematics I" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} name={field.name}>
                  <FormControl>
                    <SelectTrigger onBlur={field.onBlur} ref={field.ref}>
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Level</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} name={field.name}>
                  <FormControl>
                    <SelectTrigger onBlur={field.onBlur} ref={field.ref}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NOT_SURE}>Not sure</SelectItem>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={String(l)}>
                        {l === 700 ? "Postgraduate" : `${l} level`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {error ? (
          <p role="alert" className="text-base text-bad">
            {error}
          </p>
        ) : null}
        <ActionBar>
          <SubmitButton pending={create.isPending} pendingLabel="Checking…" spinner={false} full={false}>
            Add course
          </SubmitButton>
        </ActionBar>
      </form>
    </Form>
  );
}
