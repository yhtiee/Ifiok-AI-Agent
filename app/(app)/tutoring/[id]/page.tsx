import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { Panel } from "@/components/app/Page";
import { BookingActions } from "@/components/app/payments/BookingActions";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { bookingStatusText, sessionTime } from "@/lib/payments/booking-words";
import { SANDBOX_LABEL } from "@/lib/payments/money";
import { bookingView } from "@/lib/payments/tutoring";

export const metadata: Metadata = { title: "Tutoring session", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const link = "inline-flex min-h-11 items-center text-base text-quantity underline-offset-4 hover:underline";

// A tutoring booking (F17-FR3–FR5, 10 MVP-07): for both people, what's booked and where the money
// is, the session's lesson and practice, and the learner's steps. RLS: the learner and tutor only.
export default async function BookingPage({ params, searchParams }: PageProps<"/tutoring/[id]">) {
  const viewer = await requireOnboardedPage();
  const [{ id }, q] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const b = await bookingView(viewer, id);
  if (!b) notFound();
  const returned = q.paypal === "approved" ? "approved" : q.paypal === "cancelled" ? "cancelled" : null;

  return (
    <AppPage
      crumbs={[{ label: "Me", href: "/me" }, { label: "Tutoring", href: "/me/bookings" }, { label: b.concept.title }]}
      title={b.concept.title}
      description={`${b.role === "learner" ? "With" : "Teaching"} ${b.other} · ${sessionTime(b.startsAt)} · ${b.minutes} min`}
      width="form"
    >
      <div className="grid gap-6">
        <Panel>
          <p className="text-sm font-semibold text-quantity">{SANDBOX_LABEL}</p>
          <p className="mt-1 text-lg font-semibold">{bookingStatusText(b)}</p>
          <dl className="mt-3 grid gap-1 text-base">
            <div className="flex gap-2">
              <dt className="text-ink-2">Price</dt>
              <dd className="font-semibold tabular-nums">{b.price}</dd>
            </div>
            {b.role === "tutor" ? (
              <div className="flex gap-2">
                <dt className="text-ink-2">You get</dt>
                <dd className="tabular-nums">
                  {b.tutorShare} <span className="text-ink-2">(after Ifiok&apos;s {b.commission} commission)</span>
                </dd>
              </div>
            ) : null}
          </dl>
          {b.status === "authorized" ? (
            <p className="mt-3 text-sm text-ink-2">
              {b.role === "learner"
                ? `If you don't confirm or report a problem, it's paid on ${sessionTime(b.autoReleaseAt)}.`
                : `It's paid to you when the learner confirms, or on ${sessionTime(b.autoReleaseAt)}.`}
            </p>
          ) : null}
          {b.note && (b.status === "disputed" || b.status === "voided") ? (
            <p className="mt-3 text-sm text-ink-2">Note: {b.note}</p>
          ) : null}
        </Panel>
        {b.proposedBy === "agent" && b.agentReason ? (
          <p className="text-sm text-ink-2">Suggested by Ifiok: {b.agentReason}</p>
        ) : null}
        <section className="grid gap-1">
          <h2 className="text-base font-semibold">For the session</h2>
          <Link href={`/learn/${b.concept.id}`} className={link}>
            The lesson on {b.concept.title}
          </Link>
          <Link href={`/practice/${b.concept.id}`} className={link}>
            Practice questions to go through together
          </Link>
        </section>
        <BookingActions id={b.id} role={b.role} status={b.status} tutor={b.other} returned={returned} />
      </div>
    </AppPage>
  );
}
