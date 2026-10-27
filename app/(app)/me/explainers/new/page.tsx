import type { Metadata } from "next";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState } from "@/components/app/Page";
import { ExplainerComposer } from "@/components/app/explainers/ExplainerComposer";
import { Button } from "@/components/ui/button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { myTopicOptions } from "@/lib/contribute/topics";

export const metadata: Metadata = { title: "New explainer", robots: { index: false } };

// Make an explainer (F18, 10 MVP-06) for any of your topics; no mastery required (12 §4 Q52).
export default async function NewExplainerPage({ searchParams }: PageProps<"/me/explainers/new">) {
  const viewer = await requireOnboardedPage();
  const [topics, query] = await Promise.all([myTopicOptions(viewer), searchParams]);
  const wanted = typeof query.concept === "string" ? query.concept : null;
  return (
    <AppPage
      crumbs={[{ label: "Me", href: "/me" }, { label: "Explainers", href: "/me/explainers" }, { label: "New" }]}
      title="Explain a topic"
      width="form"
    >
      {topics.length ? (
        <ExplainerComposer
          topics={topics}
          initialConcept={wanted && topics.some((t) => t.conceptId === wanted) ? wanted : null}
        />
      ) : (
        <EmptyState
          title="Add a course or topic first"
          body="Explainers are for the topics in your courses or the topics you follow."
          action={
            <Button asChild variant="outline">
              <Link href="/courses">Find your course</Link>
            </Button>
          }
        />
      )}
    </AppPage>
  );
}
