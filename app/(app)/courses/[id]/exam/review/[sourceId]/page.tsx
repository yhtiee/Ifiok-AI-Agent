import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { ReviewPaper } from "@/components/app/exam/ReviewPaper";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getDraft } from "@/lib/exam/service";

export const metadata: Metadata = { title: "Review past questions", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Review a past paper's extracted questions before they're saved (F8-FR1, 10 MVP-04).
export default async function ReviewPaperPage({ params }: PageProps<"/courses/[id]/exam/review/[sourceId]">) {
  const viewer = await requireOnboardedPage();
  const { id, sourceId } = await params;
  if (!UUID.test(id) || !UUID.test(sourceId)) notFound();
  const data = await getDraft(viewer, id, sourceId).catch(() => null);
  if (!data) notFound();

  return (
    <AppPage
      crumbs={[
        { label: "Courses", href: "/courses" },
        { label: data.course.code, href: `/courses/${id}?tab=exam` },
        { label: "Review questions" },
      ]}
      title="Check the questions"
      description={`From ${data.source.title}. Fix anything Ifiok misread, then save.`}
    >
      <ReviewPaper
        courseId={id}
        courseCode={data.course.code}
        sourceId={sourceId}
        title={data.source.title}
        status={data.status}
        draft={data.draft}
        topics={data.topics}
      />
    </AppPage>
  );
}
