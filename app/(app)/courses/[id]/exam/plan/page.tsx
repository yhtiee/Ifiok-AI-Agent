import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState } from "@/components/app/Page";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getExamPrep } from "@/lib/exam/service";
import { SESSION_WORDS, sessionHref } from "@/lib/exam/sessions";

export const metadata: Metadata = { title: "Study plan", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

// The whole study plan to the exam date, day by day, each session with its reason (light F6, MVP-04).
// Rebuilt from current mastery each time it's opened (lib/agent/planner.ts, deterministic).
export default async function StudyPlanPage({ params }: PageProps<"/courses/[id]/exam/plan">) {
  const viewer = await requireOnboardedPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const prep = await getExamPrep(viewer, id).catch(() => null);
  if (!prep) notFound();
  const plan = prep.plan;

  return (
    <AppPage
      crumbs={[
        { label: "Courses", href: "/courses" },
        { label: prep.course.code, href: `/courses/${id}?tab=exam` },
        { label: "Study plan" },
      ]}
      title="Study plan"
      description={plan ? `To your exam on ${day(plan.examDate)}, ${plan.dailyMinutes} minutes a day.` : undefined}
    >
      {plan && plan.days.length ? (
        <ol className="grid max-w-3xl gap-6">
          {plan.days.map((d) => (
            <li key={d.date} className="grid gap-2">
              <h2 className="text-base font-semibold">{day(d.date)}</h2>
              {d.sessions.length ? (
                <ul className="grid gap-2">
                  {d.sessions.map((s, i) => (
                    <li key={i}>
                      <Link href={sessionHref(id, s)} className="group grid gap-0.5 rounded-[var(--radius-input)] py-1">
                        <span className="text-base group-hover:underline">
                          <span className="font-semibold">{SESSION_WORDS[s.kind]}:</span> {s.title} · {s.minutes} min
                        </span>
                        <span className="text-sm text-ink-2">{s.why}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">Free day</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No exam date yet"
          body="Set the exam date in the course's Exam prep tab and Ifiok lays out your sessions up to it."
        />
      )}
    </AppPage>
  );
}
