import type { Metadata } from "next";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState } from "@/components/app/Page";
import { LibraryFilters } from "@/components/app/library/LibraryFilters";
import { LibraryGrid } from "@/components/app/library/LibraryGrid";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { LIBRARY_TYPES, libraryItems, type LibraryType } from "@/lib/contribute/library";

export const metadata: Metadata = { title: "Library", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The Library (F11, F18, 12 §4 Q58, Q59): everything students have shared and explained, together in
// one grid, newest first. Search, filter by type or topic; Upload makes an explainer or shares a
// document.
export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const viewer = await requireOnboardedPage();
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 80) : "";
  const topic = typeof query.topic === "string" && UUID.test(query.topic) ? query.topic : "";
  const type: LibraryType =
    typeof query.type === "string" && (LIBRARY_TYPES as readonly string[]).includes(query.type)
      ? (query.type as LibraryType)
      : "all";
  const view = await libraryItems(viewer, { q: q || null, conceptId: topic || null, type });
  const filtered = Boolean(q || topic || type !== "all");

  return (
    <AppPage crumbs={[{ label: "Library" }]} title="Library" width="full">
      <div className="grid grid-cols-1 gap-8">
        <LibraryFilters q={q} topic={topic} type={type} topics={view.topics} />
        {view.items.length ? (
          <LibraryGrid items={view.items} />
        ) : (
          <EmptyState
            title={filtered ? "Nothing matches" : "The library is empty"}
            body={
              filtered
                ? "Try another word, type or topic."
                : "Students share explainers, notes, lab manuals and past questions here. Be the first: tap Upload."
            }
          />
        )}
      </div>
    </AppPage>
  );
}
