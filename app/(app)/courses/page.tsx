import type { Metadata } from "next";
import { EmptyState, PageBody, PageHeader, Panel } from "@/components/app/Page";
import { requireOnboardedPage } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Courses", robots: { index: false } };

// Courses (07 §4, §5.1b). The "What do you want to learn?" search, course creation and outlines
// arrive in P1-01; until then this tab shows its empty state (P0-06).
export default async function CoursesPage() {
  await requireOnboardedPage();
  return (
    <PageBody>
      <PageHeader title="Courses" description="Your courses and the topics you follow, all in one place." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6">
        <Panel title="Your courses">
          <EmptyState
            title="No courses yet"
            body="Soon you'll search for your course at your university, or type any topic, and start learning in about a minute. Nothing needs to be set up by your lecturer."
          />
        </Panel>
        <Panel title="How it works">
          <ol className="grid gap-3 text-base">
            {[
              "Find your course, or create it if nobody has yet.",
              "Snap the course outline, type the topics, or let Ifiok draft one for you to check.",
              "Open any topic. Its lesson is built once and shared with every student who needs it.",
            ].map((line, i) => (
              <li key={line} className="grid grid-cols-[auto_1fr] gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-quantity-soft text-sm font-semibold text-quantity tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="text-ink-2">{line}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </PageBody>
  );
}
