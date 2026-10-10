import { APP_TIME_ZONE } from "@ifiok/core";
import {
  BooksIcon,
  CheckCircleIcon,
  CircleIcon,
  FilePdfIcon,
  FireIcon,
  FlagIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  MedalIcon,
  TimerIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageBody, PageHeader, Panel } from "@/components/app/Page";
import { ButtonLink } from "@/components/ui/Button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { FEATURES, type FeatureKey } from "@/lib/features";
import { getLearningSummary } from "@/lib/learning/summary";
import { getSetupSteps } from "@/lib/learning/setup";

export const metadata: Metadata = { title: "Today", robots: { index: false } };

// Today is the first page a student sees, so its job is to get them learning (00 §4.6: never
// block a student; they can always start). Until they have a plan it is a start hub: every way in
// from the spec, one primary action, a setup checklist and their numbers. Once the planner lands
// (P1-06) the plan timeline takes the main column and the start options move below it.

type StartOption = { key: FeatureKey; icon: Icon; title: string; body: string };

const START_OPTIONS: StartOption[] = [
  {
    key: "topic",
    icon: MagnifyingGlassIcon,
    title: "Learn any topic",
    body: "Type a topic, like “Fourier series” or “judicial precedent”, and get a lesson you can move.",
  },
  {
    key: "outline",
    icon: ListChecksIcon,
    title: "Build your course outline",
    body: "Snap your course outline, type the topics, or let Ifiok draft one. It becomes your learning path.",
  },
  {
    key: "upload",
    icon: UploadSimpleIcon,
    title: "Upload notes or past questions",
    body: "Add your notes, past papers and lab manuals so lessons and the tutor use your material.",
  },
  {
    key: "textbook",
    icon: FilePdfIcon,
    title: "Learn from your textbook",
    body: "Pick a PDF. It stays on your phone; Ifiok builds lessons from the pages you choose.",
  },
  {
    key: "goal",
    icon: FlagIcon,
    title: "Set a goal",
    body: "An exam date, a practical, or mastering a course. Your daily plan works towards it.",
  },
];

export default async function TodayPage() {
  const { userId, profile } = await requireOnboardedPage();
  const [summary, steps] = await Promise.all([getLearningSummary(userId), getSetupSteps(userId)]);
  const doneCount = steps.filter((s) => s.done).length;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <PageBody>
      <PageHeader
        eyebrow={date}
        title="Start learning"
        description="Choose what you want to learn. Ifiok builds the lessons, practice and daily plan around it."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6">
        <div className="grid content-start gap-4 lg:gap-6">
          {/* The one primary action on this screen. */}
          <section
            aria-labelledby="start-course"
            className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6"
          >
            <div className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-change-soft text-change"
              >
                <BooksIcon size={26} />
              </span>
              <div>
                <h2 id="start-course" className="text-lg font-semibold">
                  Learn a course
                </h2>
                <p className="mt-1 max-w-[52ch] text-base text-ink-2">
                  Find your course at your university, or add it if nobody has yet. Ifiok turns it into a path of
                  topics, {profile.daily_minutes} minutes a day.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              {FEATURES.course.open ? (
                <ButtonLink href={FEATURES.course.href} full>
                  Find your course
                </ButtonLink>
              ) : (
                <OpensSoon />
              )}
            </div>
          </section>

          <Panel title="Other ways to start">
            <ul className="grid gap-px overflow-hidden rounded-[var(--radius-input)] bg-line sm:grid-cols-2 sm:[&>li:last-child:nth-child(odd)]:col-span-2">
              {START_OPTIONS.map((option) => (
                <StartRow key={option.key} option={option} />
              ))}
            </ul>
          </Panel>
        </div>

        <div className="grid content-start gap-4 lg:gap-6">
          <Panel
            title="Get set up"
            action={
              <span className="text-sm text-ink-2 tabular-nums">
                {doneCount} of {steps.length} done
              </span>
            }
          >
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={doneCount}
              className="mb-4 h-1.5 overflow-hidden rounded-full bg-line"
            >
              <div className="h-full rounded-full bg-built" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <ul className="grid gap-2.5">
              {steps.map((step) => (
                <li key={step.key} className="flex items-center gap-3 text-base">
                  {step.done ? (
                    <CheckCircleIcon size={22} weight="fill" className="shrink-0 text-built" aria-hidden="true" />
                  ) : (
                    <CircleIcon size={22} className="shrink-0 text-ink-3" aria-hidden="true" />
                  )}
                  <span className={step.done ? "text-ink-2" : ""}>{step.label}</span>
                  <span className="sr-only">{step.done ? "(done)" : "(to do)"}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Your progress">
            <ul aria-label="Your progress" className="grid divide-y divide-line">
              <Stat icon={TimerIcon} label="Daily goal" value={`${profile.daily_minutes} min`} hint="Change it in Me" />
              <Stat
                icon={FireIcon}
                label="Study streak"
                value={`${summary.streakDays} ${summary.streakDays === 1 ? "day" : "days"}`}
                hint={summary.studiedToday ? "You've studied today" : "Study today to start one"}
              />
              <Stat
                icon={MedalIcon}
                label="Topics mastered"
                value={String(summary.topicsMastered)}
                hint={`${summary.topicsStarted} started`}
                tone="built"
              />
            </ul>
          </Panel>
        </div>
      </div>
    </PageBody>
  );
}

function StartRow({ option }: { option: StartOption }) {
  const { href, open } = FEATURES[option.key];
  const IconCmp = option.icon;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          open ? "bg-quantity-soft text-quantity" : "bg-paper text-ink-2"
        }`}
      >
        <IconCmp size={22} />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="text-base font-semibold">{option.title}</span>
        <span className="hidden text-sm text-ink-2 sm:block">{option.body}</span>
        {open ? null : <span className="text-xs text-ink-3">Opens soon</span>}
      </span>
    </>
  );
  return (
    <li className="bg-surface">
      {open ? (
        <Link href={href} className="flex h-full gap-3 p-4 hover:bg-paper">
          {content}
        </Link>
      ) : (
        <div aria-disabled="true" className="flex h-full gap-3 p-4">
          {content}
        </div>
      )}
    </li>
  );
}

function OpensSoon() {
  return (
    <span className="inline-flex min-h-12 items-center rounded-full border border-dashed border-line px-5 text-sm text-ink-2">
      Opens soon
    </span>
  );
}

function Stat({
  icon: IconCmp,
  label,
  value,
  hint,
  tone = "ink",
}: {
  icon: Icon;
  label: string;
  value: string;
  hint: ReactNode;
  tone?: "ink" | "built";
}) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          tone === "built" ? "bg-built-soft text-built" : "bg-paper text-ink-2"
        }`}
      >
        <IconCmp size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-2">{label}</p>
        <p className="text-xs text-ink-2">{hint}</p>
      </div>
      <p className={`font-display text-xl font-semibold tabular-nums ${tone === "built" ? "text-built" : ""}`}>
        {value}
      </p>
    </li>
  );
}
