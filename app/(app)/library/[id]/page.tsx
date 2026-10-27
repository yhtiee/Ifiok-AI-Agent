import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { SectionHeading } from "@/components/app/Page";
import { DataSaverSwitch, ExplainerCard } from "@/components/app/explainers/ExplainerCard";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { watchExplainer } from "@/lib/contribute/explainers";
import { mathHtmlFor } from "@/lib/exam/math";

export const metadata: Metadata = { title: "Explainer", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const link = "inline-flex min-h-11 items-center text-base text-quantity underline-offset-4 hover:underline";

// Watching one explainer (12 §4 Q58): the player, then more on the same topic and a way into its lesson.
export default async function WatchPage({ params }: PageProps<"/library/[id]">) {
  const viewer = await requireOnboardedPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await watchExplainer(viewer, id);
  if (!data) notFound();
  const { explainer: ex, more } = data;
  const math = mathHtmlFor([ex, ...more].flatMap((e) => (e.body ? [e.body] : [])));

  return (
    <AppPage
      crumbs={[{ label: "Library", href: "/library" }, { label: ex.title }]}
      title={ex.title}
      description={ex.concept.title}
    >
      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] xl:gap-16">
        <div className="grid grid-cols-1 content-start gap-4">
          <DataSaverSwitch />
          <ExplainerCard ex={ex} math={math} />
          <p className="flex flex-wrap gap-x-5">
            <Link href={`/learn/${ex.concept.id}`} className={link}>
              Open the lesson on {ex.concept.title}
            </Link>
            <Link href={`/explainers/${ex.concept.id}`} className={link}>
              Tutors for this topic
            </Link>
          </p>
        </div>
        <section aria-labelledby="more" className="grid content-start gap-3">
          <SectionHeading id="more">More on {ex.concept.title}</SectionHeading>
          {more.length ? (
            <ul className="grid gap-3">
              {more.map((m) => (
                <li key={m.id}>
                  <Link href={`/library/${m.id}`} className="group grid gap-0.5 border-t border-line pt-3">
                    <span className="text-base font-semibold group-hover:underline">{m.title}</span>
                    <span className="text-sm text-ink-2">
                      {m.author.name} · {m.kind === "text" ? "Written" : m.kind === "voice" ? "Voice note" : "Video"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-ink-2">No other explainers on this topic yet.</p>
          )}
        </section>
      </div>
    </AppPage>
  );
}
