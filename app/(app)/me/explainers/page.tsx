import type { Metadata } from "next";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { ActionBar, EmptyState } from "@/components/app/Page";
import { MyExplainersList } from "@/components/app/contribute/MyExplainersList";
import { Button } from "@/components/ui/button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { myExplainers } from "@/lib/contribute/explainers";

export const metadata: Metadata = { title: "Your explainers", robots: { index: false } };

// Your explainers (F18, 10 MVP-06): each one's review status in words, and withdraw.
export default async function MyExplainersPage() {
  const viewer = await requireOnboardedPage();
  const list = await myExplainers(viewer);
  return (
    <AppPage crumbs={[{ label: "Me", href: "/me" }, { label: "Explainers" }]} title="Your explainers">
      {list.length ? (
        <MyExplainersList
          items={list.map((e) => ({
            id: e.id,
            title: e.title,
            kind: e.kind,
            status: e.status,
            reason: e.reason,
            concept: e.concept,
          }))}
        />
      ) : (
        <EmptyState
          title="No explainers yet"
          body="Teach a topic you understand in writing, a voice note (up to 5 minutes) or a short video (up to 3 minutes). You earn Units each month it helps other students."
        />
      )}
      <ActionBar>
        <Button asChild>
          <Link href="/me/explainers/new">New explainer</Link>
        </Button>
      </ActionBar>
    </AppPage>
  );
}
