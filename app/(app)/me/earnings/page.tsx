import type { Metadata } from "next";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState, Panel, SectionHeading } from "@/components/app/Page";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getEarnings } from "@/lib/contribute/earnings";

export const metadata: Metadata = { title: "My earnings", robots: { index: false } };

const SHARE_WORDS = {
  checking: "Being checked",
  approved: "In the library",
  held: "Waiting for a person to check it",
  rejected: "Not added",
} as const;
const EXPLAINER_WORDS: Record<string, string> = {
  uploading: "Upload didn't finish",
  processing: "Being checked",
  pending_admin: "Waiting for approval",
  held: "Waiting for a person to check it",
  approved: "Live",
  rejected: "Not approved",
};
const link = "inline-flex min-h-11 items-center text-base text-quantity underline-offset-4 hover:underline";
const points = (n: number) => `${n} ${n === 1 ? "point" : "points"}`;

// My earnings (06 §0, §2, §4, 10 MVP-06): usage points and Units earned, pending until the wallet
// opens. No cash moves and no naira amount is shown until a contribution pool exists.
export default async function EarningsPage() {
  const viewer = await requireOnboardedPage();
  const e = await getEarnings(viewer);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(`${e.month}T00:00:00Z`),
  );

  return (
    <AppPage crumbs={[{ label: "Me", href: "/me" }, { label: "My earnings" }]} title="My earnings">
      <div className="grid max-w-6xl gap-10 xl:grid-cols-2 xl:gap-16">
        <div className="grid content-start gap-6">
          <Panel>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-0.5">
                <dt className="text-sm text-ink-2">Usage points in {month}</dt>
                <dd className="font-display text-3xl font-semibold text-quantity tabular-nums">{e.pointsThisMonth}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-sm text-ink-2">Units earned in {month}</dt>
                <dd className="font-display text-3xl font-semibold text-built tabular-nums">
                  {e.unitsThisMonth}
                  <span className="text-base font-normal text-ink-2"> of {e.unitsCap}</span>
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-ink-2">
              {e.unitsPending} Units earned so far, waiting for your wallet. They arrive when Units open after launch.
            </p>
          </Panel>
          <div className="grid gap-2 text-base">
            <p>
              You get a point each month for every student who finishes your explainer or a lesson screen quoting your
              shared material, and 1 Unit for each of those students. An approved share earns 5 Units.
            </p>
            <p className="text-ink-2">Cash payouts from the contribution pool open after launch.</p>
          </div>
        </div>

        <div className="grid content-start gap-10">
          <section aria-labelledby="my-shares" className="grid gap-3">
            <SectionHeading id="my-shares">Shared materials</SectionHeading>
            {e.shares.length ? (
              <ul className="divide-y divide-line border-y border-line">
                {e.shares.map((s) => (
                  <li key={s.id} className="grid gap-0.5 py-3">
                    <span className="text-base font-semibold">{s.title}</span>
                    <span className="text-sm text-ink-2">
                      {SHARE_WORDS[s.state]}
                      {s.reason ? `: ${s.reason}` : ""} · {points(s.points)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nothing shared yet"
                body="Share your own notes, past questions, lab manuals or worked solutions from a course's Materials tab."
              />
            )}
          </section>

          <section aria-labelledby="my-explainers" className="grid gap-3">
            <SectionHeading id="my-explainers">Explainers</SectionHeading>
            {e.explainers.length ? (
              <ul className="divide-y divide-line border-y border-line">
                {e.explainers.map((x) => (
                  <li key={x.id} className="grid gap-0.5 py-3">
                    <span className="text-base font-semibold">{x.title}</span>
                    <span className="text-sm text-ink-2">
                      {EXPLAINER_WORDS[x.status] ?? x.status} · {points(x.points)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-ink-2">No explainers yet.</p>
            )}
            <Link href="/me/explainers/new" className={link}>
              Explain a topic
            </Link>
          </section>
        </div>
      </div>
    </AppPage>
  );
}
