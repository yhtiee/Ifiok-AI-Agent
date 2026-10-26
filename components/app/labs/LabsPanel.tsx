"use client";

import { FlaskIcon, HourglassMediumIcon, ProhibitIcon, WarningCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { ActionBar, EmptyState, Row, RowList, SectionHeading } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import { fmtPct } from "@/components/labs/experiment/model";
import { useRequestLab } from "@/lib/queries/labs";
import { ApiError } from "@/lib/query/api";
import { cn } from "@/lib/utils";

// Virtual labs (10 MVP-05, 12 §4 Q55): the student's labs, what is being built, what was declined
// and why, and "Request a lab". Lives in Practice (all labs) and in a course's Labs tab.

export type LabsPanelView = {
  labs: {
    id: string;
    title: string;
    origin: "manual" | "topic";
    status: "ready" | "declined";
    reason: string | null;
    courseId: string | null;
    courseCode: string | null;
    sourceTitle: string | null;
    runs: number;
    lastErrorPct: number | null;
  }[];
  requests: {
    jobId: string;
    label: string;
    courseId: string | null;
    status: "building" | "declined" | "failed";
    reason: string | null;
  }[];
};

export function LabsPanel(props: {
  view: LabsPanelView;
  /** A course's Labs tab: requests are filed under it and the request is the view's main action. */
  courseId: string | null;
  /** Practice: the courses a request can be filed under. */
  courses?: { id: string; code: string }[];
  headingId?: string;
  /** The Labs page: the request is the view's one camwood action, and the page title is the heading. */
  primary?: boolean;
  hideHeading?: boolean;
}) {
  const router = useRouter();
  const { view, courseId } = props;
  const building = view.requests.some((r) => r.status === "building");
  // While a lab is being built, check back every few seconds.
  useEffect(() => {
    if (!building) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [building, router]);

  const headingId = props.headingId ?? "labs";
  const ready = view.labs.filter((l) => l.status === "ready");
  const declined = view.labs.filter((l) => l.status === "declined");
  const addManual = courseId ? `/materials/add?course=${courseId}` : "/materials/add";

  return (
    <section
      aria-labelledby={props.hideHeading ? undefined : headingId}
      aria-label={props.hideHeading ? "Labs" : undefined}
      className="grid content-start gap-4"
    >
      {props.hideHeading ? null : <SectionHeading id={headingId}>Labs</SectionHeading>}
      <p className="max-w-2xl text-base text-ink-2">
        Run a practical your lab can&apos;t: set the variable, take readings, plot the graph and work out the result.
        Every reading comes from Ifiok&apos;s experiment engine.
      </p>

      {view.requests.length ? (
        <RowList label="Lab requests">
          {view.requests.map((r) => (
            <Row
              key={r.jobId}
              icon={
                r.status === "building" ? (
                  <HourglassMediumIcon size={22} />
                ) : r.status === "declined" ? (
                  <ProhibitIcon size={22} />
                ) : (
                  <WarningCircleIcon size={22} />
                )
              }
              tone="plain"
              title={r.label}
              meta={
                r.status === "building"
                  ? "Building the lab… about a minute"
                  : r.status === "declined"
                    ? `Not available as a virtual lab${r.reason ? `: ${r.reason}` : "."}`
                    : (r.reason ?? "Ifiok couldn't build this lab. Try again.")
              }
            />
          ))}
        </RowList>
      ) : null}

      {ready.length ? (
        <RowList label="Your labs">
          {ready.map((l) => (
            <Row
              key={`${l.id}:${l.courseId}`}
              href={`/labs/${l.id}`}
              icon={<FlaskIcon size={22} />}
              tone="topic"
              title={l.title}
              meta={[
                courseId ? null : l.courseCode,
                l.origin === "manual"
                  ? `From your manual${l.sourceTitle ? `, ${l.sourceTitle}` : ""}`
                  : "Generated from the topic, not your manual",
                l.runs
                  ? `${l.runs} ${l.runs === 1 ? "run" : "runs"}${l.lastErrorPct !== null ? ` · last ${fmtPct(l.lastErrorPct)} off` : ""}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </RowList>
      ) : !view.requests.length ? (
        <EmptyState
          title="No labs yet"
          body="Request a practical by name, or add your lab manual and Ifiok turns its practicals into labs."
        />
      ) : null}

      {declined.length ? (
        <details className="text-base">
          <summary className="min-h-11 cursor-pointer py-2 text-ink-2">
            {declined.length} {declined.length === 1 ? "practical" : "practicals"} from your manuals can&apos;t run as a
            virtual lab
          </summary>
          <ul className="grid gap-2 pt-1">
            {declined.map((l) => (
              <li key={l.id}>
                <span className="font-semibold">{l.title}</span>
                <span className="block text-sm text-ink-2">
                  {l.reason ?? "It isn't a measure-and-analyse practical."}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <RequestLabForm courseId={courseId} courses={props.courses} primary={props.primary ?? Boolean(courseId)} />
      <Link
        href={addManual}
        className="inline-flex min-h-11 items-center justify-self-start text-base text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        Add a lab manual
      </Link>
    </section>
  );
}

function RequestLabForm(props: {
  courseId: string | null;
  courses?: { id: string; code: string }[];
  primary: boolean;
}) {
  const router = useRouter();
  const request = useRequestLab();
  const topicId = useId();
  const courseFieldId = useId();
  const [topic, setTopic] = useState("");
  const [course, setCourse] = useState(props.courseId ?? props.courses?.[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (topic.trim().length < 3) return setError("Name the practical, like “Hooke's law”.");
    request.mutate(
      { topic: topic.trim(), course_id: props.courseId ?? (course || null) },
      {
        onSuccess: (r) => {
          setTopic("");
          if (r.status === "added") {
            toast("Lab added: someone already built it.");
            router.push(`/labs/${r.labId}`);
          } else {
            toast("Building your lab. It appears here in about a minute.");
            router.refresh();
          }
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "That didn't go through. Try again."),
      },
    );
  };

  const button = (
    <Button
      type="submit"
      variant={props.primary ? "default" : "outline"}
      disabled={request.isPending}
      aria-busy={request.isPending}
    >
      {request.isPending ? "Requesting…" : "Request a lab"}
    </Button>
  );

  return (
    <form
      className="grid max-w-2xl gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={topicId} className="grid min-w-56 flex-1 gap-1.5">
          <span className="text-base font-semibold">Which practical?</span>
          <Input
            id={topicId}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Hooke's law, simple pendulum, Ohm's law…"
            maxLength={120}
          />
        </label>
        {!props.courseId && props.courses?.length ? (
          <label htmlFor={courseFieldId} className="grid gap-1.5">
            <span className="text-base font-semibold">For</span>
            <select
              id={courseFieldId}
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className={cn(fieldClass, "w-40")}
            >
              {props.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
              <option value="">No course</option>
            </select>
          </label>
        ) : null}
        {props.primary ? null : button}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}
      {props.primary ? <ActionBar>{button}</ActionBar> : null}
    </form>
  );
}
