import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage, type Crumb } from "@/components/app/AppPage";
import { StoredFile } from "@/components/app/library/StoredFile";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { ownMaterial } from "@/lib/materials/files";
import { SOURCE_KIND_LABELS } from "@ifiok/core/materials/kinds";

export const metadata: Metadata = { title: "Material", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One of the student's own materials (12 §4 Q60): the file they uploaded, in Ifiok's viewer.
export default async function MaterialPage({ params }: PageProps<"/materials/[id]">) {
  const viewer = await requireOnboardedPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const material = await ownMaterial(viewer, id);
  if (!material) notFound();

  const crumbs: Crumb[] = material.courseId
    ? [
        { label: "Courses", href: "/courses" },
        { label: "Materials", href: `/courses/${material.courseId}?tab=materials` },
      ]
    : material.conceptId
      ? [{ label: "Topic", href: `/learn/${material.conceptId}` }]
      : [];

  return (
    <AppPage
      crumbs={[...crumbs, { label: material.title }]}
      title={material.title}
      description={SOURCE_KIND_LABELS[material.kind] ?? material.kind}
    >
      <StoredFile {...material} />
    </AppPage>
  );
}
