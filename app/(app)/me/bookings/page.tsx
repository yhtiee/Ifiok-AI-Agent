import type { Metadata } from "next";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState, Row, RowList, SectionHeading } from "@/components/app/Page";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { bookingStatusText, sessionTime } from "@/lib/payments/booking-words";
import { SANDBOX_LABEL } from "@/lib/payments/money";
import { myBookings, type BookingView } from "@/lib/payments/tutoring";

export const metadata: Metadata = { title: "Tutoring", robots: { index: false } };

// Tutoring sessions (F17, 10 MVP-07): the ones you booked and the ones you teach.
export default async function BookingsPage() {
  const viewer = await requireOnboardedPage();
  const all = await myBookings(viewer);
  const list = (rows: BookingView[], label: string) => (
    <RowList label={label}>
      {rows.map((b) => (
        <Row
          key={b.id}
          href={`/tutoring/${b.id}`}
          title={`${b.concept.title} · ${b.other}`}
          meta={`${sessionTime(b.startsAt)} · ${b.price} · ${bookingStatusText(b)}`}
        />
      ))}
    </RowList>
  );
  const booked = all.filter((b) => b.role === "learner");
  const teaching = all.filter((b) => b.role === "tutor");

  return (
    <AppPage
      crumbs={[{ label: "Me", href: "/me" }, { label: "Tutoring" }]}
      title="Tutoring"
      description={SANDBOX_LABEL}
    >
      <div className="grid max-w-6xl gap-10 xl:grid-cols-2 xl:gap-16">
        <section aria-labelledby="booked" className="grid content-start gap-3">
          <SectionHeading id="booked">Sessions you booked</SectionHeading>
          {booked.length ? (
            list(booked, "Sessions you booked")
          ) : (
            <EmptyState title="No sessions yet" body="Book a tutor from any topic's student explainers page." />
          )}
        </section>
        <section aria-labelledby="teaching" className="grid content-start gap-3">
          <SectionHeading id="teaching">Sessions you teach</SectionHeading>
          {teaching.length ? list(teaching, "Sessions you teach") : <p className="text-base text-ink-2">None yet.</p>}
        </section>
      </div>
    </AppPage>
  );
}
