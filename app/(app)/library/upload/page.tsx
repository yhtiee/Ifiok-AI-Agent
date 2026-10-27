import type { Metadata } from "next";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState } from "@/components/app/Page";
import { LibraryUploadForm } from "@/components/app/library/LibraryUploadForm";
import { Button } from "@/components/ui/button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { myTopicOptions } from "@/lib/contribute/topics";

export const metadata: Metadata = { title: "Upload to the library", robots: { index: false } };

// Upload to the Library (12 §4 Q58): straight to the contribution pool, not to a course.
export default async function LibraryUploadPage() {
  const viewer = await requireOnboardedPage();
  const topics = await myTopicOptions(viewer);
  return (
    <AppPage
      crumbs={[{ label: "Library", href: "/library" }, { label: "Upload" }]}
      title="Upload to the library"
      width="form"
    >
      {topics.length ? (
        <LibraryUploadForm topics={topics} />
      ) : (
        <EmptyState
          title="Add a course or topic first"
          body="Uploads are filed under a topic, so other students learning it can use them."
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
