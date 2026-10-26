import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { PracticePaperSession } from "@/components/app/exam/PracticePaperSession";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { mathHtmlFor } from "@/lib/exam/math";
import { buildPracticePaper } from "@/lib/exam/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Practice paper", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A timed practice paper (10 MVP-04): past questions by share of marks × weakness, plus checked
// practice questions on the weakest topics. Answers never reach the browser before marking.
export default async function PracticePaperPage({ params }: PageProps<"/courses/[id]/exam/paper">) {
  const viewer = await requireOnboardedPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const paper = await buildPracticePaper(viewer, id).catch(() => null);
  if (!paper) notFound();
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("code").eq("id", id).maybeSingle();
  const math = mathHtmlFor(
    paper.questions.flatMap((q) => [q.text, ...(q.kind === "mcq" ? q.options.map((o) => o.text) : [])]),
  );

  return (
    <AppPage
      crumbs={[
        { label: "Courses", href: "/courses" },
        { label: course?.code ?? "Course", href: `/courses/${id}?tab=exam` },
        { label: "Practice paper" },
      ]}
      title="Timed practice paper"
    >
      <PracticePaperSession questions={paper.questions} minutes={paper.minutes} math={math} courseId={id} />
    </AppPage>
  );
}
