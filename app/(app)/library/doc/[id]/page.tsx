import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { SectionHeading } from "@/components/app/Page";
import { DocViewer, TextDocument } from "@/components/app/library/DocViewer";
import { KIND_WORDS } from "@/components/app/library/LibraryGrid";
import { ReportButton } from "@/components/app/library/ReportButton";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { libraryDoc, libraryItems } from "@/lib/contribute/library";

export const metadata: Metadata = { title: "Document", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A Library document (12 §4 Q59): read on its own, like a video on its watch page; more from the
// Library on the same topic beside it. Nothing here links to a course or lesson.
export default async function LibraryDocPage({ params }: PageProps<"/library/doc/[id]">) {
  const viewer = await requireOnboardedPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const doc = await libraryDoc(viewer, id);
  if (!doc) notFound();
  const more = doc.concept
    ? (await libraryItems(viewer, { q: null, conceptId: doc.concept.id, type: "all" })).items
        .filter((i) => i.id !== doc.id)
        .slice(0, 8)
    : [];

  return (
    <AppPage
      crumbs={[{ label: "Library", href: "/library" }, { label: doc.title }]}
      title={doc.title}
      description={[KIND_WORDS[doc.kind], doc.isYou ? "You" : doc.author, doc.concept?.title]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] xl:gap-16">
        <div className="grid grid-cols-1 content-start gap-4">
          {doc.pdfUrl ? <DocViewer url={doc.pdfUrl} title={doc.title} /> : <TextDocument pages={doc.pages} />}
          {doc.isYou ? null : <ReportButton endpoint={`/api/library/doc/${doc.id}/report`} />}
        </div>
        {doc.concept ? (
          <section aria-labelledby="more" className="grid content-start gap-3">
            <SectionHeading id="more">More on {doc.concept.title}</SectionHeading>
            {more.length ? (
              <ul className="grid gap-3">
                {more.map((m) => (
                  <li key={`${m.type}:${m.id}`}>
                    <Link
                      href={m.type === "explainer" ? `/library/${m.id}` : `/library/doc/${m.id}`}
                      className="group grid gap-0.5 border-t border-line pt-3"
                    >
                      <span className="text-base font-semibold group-hover:underline">{m.title}</span>
                      <span className="text-sm text-ink-2">
                        {m.author} · {m.type === "explainer" ? KIND_WORDS[m.format] : KIND_WORDS[m.kind]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-ink-2">Nothing else on this topic yet.</p>
            )}
            <Link
              href={`/library?topic=${doc.concept.id}`}
              className="inline-flex min-h-11 items-center justify-self-start text-base text-quantity underline-offset-4 hover:underline"
            >
              Everything on this topic
            </Link>
          </section>
        ) : null}
      </div>
    </AppPage>
  );
}
