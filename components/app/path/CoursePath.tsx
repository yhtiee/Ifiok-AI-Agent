"use client";

import { CaretRightIcon, NotebookIcon, ExamIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ActionBar } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { lessonStateText, masteryText, type PathTopic } from "@/lib/courses/path-rules";
import { useCoursePath, type CoursePathData } from "@/lib/queries/courses";
import { useMaterials } from "@/lib/queries/materials";

// The course Path (07 §5.2, 10 MVP-02, app-overhaul §5.4): "Next up" with the screen's one camwood
// action, then a vertical Ink Line of topic nodes in outline order. Each node says, in words,
// where its lesson stands (from your notes, ready, building) and the mastery level. Rows open the
// lesson straight away; a topic with practice questions also links to practising it (MVP-03).

/** After materials finish processing, keep checking for the lessons they trigger. */
const GRACE_MS = 30_000;

type Props = {
  courseId: string;
  initial: CoursePathData;
  /** Draft and locked notes, shown above the Path. */
  notes?: ReactNode;
  /** The quiet "Edit the outline" link under the list (members who can edit). */
  footer?: ReactNode;
};

export function CoursePath({ courseId, initial, notes, footer }: Props) {
  const materials = useMaterials({ courseId });
  const processing = Boolean(materials.data?.materials.some((m) => m.status === "processing"));
  const [grace, setGrace] = useState(false);
  const [wasProcessing, setWasProcessing] = useState(processing);
  if (processing !== wasProcessing) {
    // Materials just finished: their lessons are queued in the next few seconds.
    setWasProcessing(processing);
    if (!processing) setGrace(true);
  }
  useEffect(() => {
    if (!grace) return;
    const t = setTimeout(() => setGrace(false), GRACE_MS);
    return () => clearTimeout(t);
  }, [grace]);

  const { data } = useCoursePath(courseId, initial, processing || grace);
  const next = data.topics.find((t) => t.topicId === data.nextUpTopicId) ?? null;
  const fromNotes = data.topics.filter((t) => t.fromNotes).length;

  return (
    <div className="grid gap-6">
      {notes ? <div className="grid gap-3">{notes}</div> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start">
          {next?.conceptId ? (
            <section
              aria-labelledby="next-up"
              className="grid gap-4 border-l-[3px] border-change bg-surface py-3 pr-4 pl-4 lg:rounded-r-[var(--radius-card)] lg:py-4"
            >
              <div className="grid gap-0.5">
                <p id="next-up" className="text-sm text-ink-2">
                  Next up
                </p>
                <p className="text-lg font-semibold [overflow-wrap:anywhere]">{next.title}</p>
                <p className="text-sm text-ink-2">
                  {lessonStateText(next)} · {masteryText(next.mastery, next.tried)}
                </p>
              </div>
              <ActionBar>
                <Button asChild>
                  <Link href={`/learn/${next.conceptId}?course=${courseId}`}>
                    Start {next.title.length > 28 ? "lesson" : next.title}
                  </Link>
                </Button>
              </ActionBar>
            </section>
          ) : data.topics.length ? (
            <p className="text-base text-ink-2">Every topic is Proficient or better.</p>
          ) : null}
        </div>

        <div className="grid content-start gap-4 lg:col-start-1 lg:row-start-1">
          {fromNotes ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-ink-2">
              <NotebookIcon size={18} aria-hidden="true" /> {fromNotes} from your notes
            </p>
          ) : null}
          <ol className="relative grid" aria-label="Topics in order">
            {data.topics.map((t, i) => (
              <PathNode
                key={t.topicId}
                topic={t}
                index={i}
                last={i === data.topics.length - 1}
                isNext={t.topicId === data.nextUpTopicId}
                courseId={courseId}
              />
            ))}
          </ol>
          {footer}
        </div>
      </div>
    </div>
  );
}

function PathNode(props: { topic: PathTopic; index: number; last: boolean; isNext: boolean; courseId: string }) {
  const { topic: t, index, last, isNext, courseId } = props;
  const done = t.mastery === "proficient" || t.mastery === "mastered";
  const notes = t.fromNotes || t.covered;
  const node = (
    <>
      <span className="relative flex w-7 shrink-0 justify-center" aria-hidden="true">
        {last ? null : <span className="absolute top-7 -bottom-3 w-0.5 bg-line" />}
        <span
          className={`mt-1 h-5 w-5 rounded-full border-[3px] ${
            done
              ? "border-built bg-built"
              : t.lesson === "ready"
                ? "border-quantity bg-quantity-soft"
                : "border-ink-3 bg-surface"
          } ${isNext ? "outline-2 outline-offset-2 outline-change" : ""}`}
        />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5 pb-5">
        <span className="text-sm text-ink-2 tabular-nums">{t.week ? `Week ${t.week}` : `Topic ${index + 1}`}</span>
        <span className="text-base font-semibold [overflow-wrap:anywhere] group-hover:underline">{t.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
          <span className={`inline-flex items-center gap-1 ${notes ? "text-quantity" : ""}`}>
            {notes ? <NotebookIcon size={16} aria-hidden="true" /> : null}
            {lessonStateText(t)}
          </span>
          <span aria-hidden="true">·</span>
          <span className={done ? "text-built" : undefined}>{masteryText(t.mastery, t.tried)}</span>
        </span>
      </span>
      {t.conceptId ? <CaretRightIcon size={18} className="mt-6 shrink-0 text-ink-2" aria-hidden="true" /> : null}
    </>
  );
  return (
    <li>
      {t.conceptId ? (
        <Link
          href={`/learn/${t.conceptId}?course=${courseId}`}
          aria-current={isNext ? "step" : undefined}
          className="group flex gap-3 px-1"
        >
          {node}
        </Link>
      ) : (
        <div className="flex gap-3 px-1">{node}</div>
      )}
      {t.conceptId && t.practice ? (
        <Link
          href={`/practice/${t.conceptId}?course=${courseId}`}
          className="-mt-4 mb-2 ml-11 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-quantity hover:underline"
        >
          <ExamIcon size={16} aria-hidden="true" />
          Practise · {t.practice} {t.practice === 1 ? "question" : "questions"}
        </Link>
      ) : null}
    </li>
  );
}
