import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { Lab } from "@/components/labs/experiment/Lab";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getLabPage } from "@/lib/labs/service";

export const metadata: Metadata = { title: "Lab", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One virtual lab (10 MVP-05): the experiment engine with this lab's public configuration.
export default async function LabPage({ params }: PageProps<"/labs/[id]">) {
  const viewer = await requireOnboardedPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const lab = await getLabPage(viewer, id).catch(() => null);
  if (!lab) notFound();
  return (
    <AppPage crumbs={[{ label: "Labs", href: "/labs" }, { label: lab.title }]} title={lab.title}>
      <Lab labId={lab.id} experiment={lab.experiment} origin={lab.origin} sourceTitle={lab.sourceTitle} />
    </AppPage>
  );
}
