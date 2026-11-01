import "server-only";
import { z } from "zod";
import { PaypalError } from "@ifiok/core/payments/paypal";
import {
  autoReleaseAt,
  bookingStep,
  loadBooking,
  payTutor,
  releaseBooking,
  tutorShareCents,
  voidBooking,
  type Booking,
} from "@ifiok/core/payments/tutoring";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { getConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usd } from "./money";
import { getPaypal } from "./paypal";

// Tutoring bookings in the PayPal sandbox (F17, 06 §12, §15, 10 MVP-07). Booking creates an order
// with intent AUTHORIZE; after the learner approves on PayPal the server authorises it (funds held,
// nothing captured). The learner confirms → capture → the tutor is paid minus the take rate; tutor
// no-show → void; a dispute freezes it for an admin. Unconfirmed holds release 24 h after the
// session (worker `tutoring_release`). The study agent can propose a booking, but only the learner's
// tap creates the authorisation (lib/payments/agent.ts).

const deps = () => ({ db: createAdminClient(), paypal: getPaypal() });
const MSG = {
  missing: "That booking doesn't exist.",
  paypal: "PayPal (sandbox) didn't answer. Try again in a minute.",
} as const;

function paypalFailed(err: unknown): never {
  if (err instanceof RouteError) throw err;
  // Metadata only (guardrail 10): PayPal's status and error code, or the network error's name.
  console.warn(
    "[paypal]",
    JSON.stringify(
      err instanceof PaypalError
        ? { status: err.status, code: err.code }
        : {
            error:
              err instanceof Error
                ? `${err.name}: ${(err.cause as { code?: string } | undefined)?.code ?? ""}`
                : "unknown",
          },
    ),
  );
  if (err instanceof PaypalError && err.code === "ORDER_NOT_APPROVED")
    throw new RouteError(
      409,
      "PayPal hasn't approved the payment yet. Approve it on PayPal, then try again.",
      "not_approved",
    );
  throw new RouteError(502, MSG.paypal, "paypal_failed");
}

export const bookingBody = z.object({
  tutor_id: z.string().uuid(),
  concept_id: z.string().uuid(),
  starts_at: z.iso.datetime({ offset: true }),
  /** The tutoring agent's proposal this booking approves (12 §4 Q63); its reason comes from the server. */
  proposal_id: z.string().uuid().optional(),
});

/** A tutor who offers this topic, with a price, and isn't the learner. */
async function bookableTutor(tutorId: string, conceptId: string) {
  const admin = createAdminClient();
  const [{ data: profile }, { data: offers }] = await Promise.all([
    admin.from("tutor_profiles").select("active, price_cents").eq("user_id", tutorId).maybeSingle(),
    admin.from("tutor_concepts").select("concept_id").eq("user_id", tutorId).eq("concept_id", conceptId).maybeSingle(),
  ]);
  if (!profile?.active || !offers || !profile.price_cents) return null;
  return { priceCents: profile.price_cents };
}

export async function createBooking(viewer: Viewer, body: z.infer<typeof bookingBody>, origin: string) {
  if (body.tutor_id === viewer.userId) throw new RouteError(422, "You can't book yourself.", "self_booking");
  const startsAt = new Date(body.starts_at);
  if (startsAt.getTime() < Date.now() - 5 * 60_000) throw new RouteError(422, "Pick a time from now on.", "past_time");
  const tutor = await bookableTutor(body.tutor_id, body.concept_id);
  if (!tutor) throw new RouteError(409, "That tutor isn't taking bookings for this topic now.", "not_bookable");
  const cfg = await getConfig("tutoring");
  const admin = createAdminClient();
  // An agent proposal: the student's own, still open, for this tutor and topic, and inside the limit.
  let proposal: { id: string; reason: string } | null = null;
  if (body.proposal_id) {
    const { data: p } = await admin
      .from("agent_proposals")
      .select("id, user_id, tutor_id, concept_id, status, reason, spend_limit_cents")
      .eq("id", body.proposal_id)
      .maybeSingle();
    if (!p || p.user_id !== viewer.userId || p.status !== "proposed")
      throw new RouteError(409, "That suggestion isn't open any more. Ask Ifiok again.", "proposal_closed");
    if (p.tutor_id !== body.tutor_id || p.concept_id !== body.concept_id)
      throw new RouteError(409, "That suggestion was for a different tutor or topic.", "proposal_mismatch");
    if (tutor.priceCents > p.spend_limit_cents)
      throw new RouteError(409, "This tutor's price is now above your limit. Ask Ifiok again.", "over_limit");
    proposal = { id: p.id, reason: p.reason };
  }
  const { data: concept } = await admin.from("concepts").select("title").eq("id", body.concept_id).maybeSingle();
  const { data: booking, error } = await admin
    .from("tutoring_bookings")
    .insert({
      learner_id: viewer.userId,
      tutor_id: body.tutor_id,
      concept_id: body.concept_id,
      starts_at: startsAt.toISOString(),
      minutes: cfg.session_minutes,
      price_cents: tutor.priceCents,
      take_rate_bp: Math.round(cfg.take_rate * 10_000),
      proposed_by: proposal ? "agent" : "learner",
      agent_reason: proposal?.reason.slice(0, 400) ?? null,
      proposal_id: proposal?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !booking) throw new RouteError(503, "Ifiok couldn't start the booking. Try again.", "book_failed");
  if (proposal)
    await admin.from("agent_proposals").update({ status: "booked", booking_id: booking.id }).eq("id", proposal.id);

  try {
    const { orderId, approveUrl } = await getPaypal().createAuthorizeOrder({
      amountCents: tutor.priceCents,
      description: `Ifiok tutoring: ${concept?.title ?? "a topic"} (${cfg.session_minutes} min)`,
      customId: booking.id,
      returnUrl: `${origin}/tutoring/${booking.id}?paypal=approved`,
      cancelUrl: `${origin}/tutoring/${booking.id}?paypal=cancelled`,
    });
    if (!approveUrl) throw new RouteError(502, MSG.paypal, "paypal_failed");
    await bookingStep(admin, booking.id, "ordered", orderId);
    return { id: booking.id, approveUrl };
  } catch (err) {
    await bookingStep(admin, booking.id, "failed", null, "PayPal order not created");
    paypalFailed(err);
  }
}

async function partyBooking(viewer: Viewer, id: string, as: "learner" | "either" = "either"): Promise<Booking> {
  const b = await loadBooking(createAdminClient(), id);
  const ok = b && (b.learner_id === viewer.userId || (as === "either" && b.tutor_id === viewer.userId));
  if (!ok) throw new RouteError(404, MSG.missing, "not_found");
  return b!;
}

/** Back from PayPal: authorise the approved order (the hold) and schedule the auto-release. */
export async function authorizeBooking(viewer: Viewer, id: string) {
  const b = await partyBooking(viewer, id, "learner");
  if (b.status !== "awaiting_payment") return { status: b.status };
  if (!b.paypal_order_id) throw new RouteError(409, "This booking has no PayPal payment. Book again.", "no_order");
  const admin = createAdminClient();
  try {
    const out = await getPaypal().authorizeOrder(b.paypal_order_id);
    if (!out.authorizationId) throw new RouteError(502, MSG.paypal, "paypal_failed");
    await bookingStep(admin, id, "authorized", out.authorizationId);
  } catch (err) {
    paypalFailed(err);
  }
  await admin.rpc("enqueue_job_once", {
    p_queue: "tutoring_release",
    p_payload: { booking_id: id },
    p_dedupe: `release:${id}`,
    p_owner: b.learner_id,
  });
  return { status: "authorized" };
}

export async function cancelBooking(viewer: Viewer, id: string) {
  const b = await partyBooking(viewer, id, "learner");
  await bookingStep(createAdminClient(), b.id, "cancelled", null, "Cancelled before paying");
}

/** The learner says the session happened: capture and pay the tutor. */
export async function confirmBooking(viewer: Viewer, id: string) {
  const b = await partyBooking(viewer, id, "learner");
  if (b.status !== "authorized" && b.status !== "captured")
    throw new RouteError(409, "This booking can't be confirmed now.", "bad_state");
  try {
    return await releaseBooking(deps(), id, "learner");
  } catch (err) {
    paypalFailed(err);
  }
}

/** The tutor didn't show: void the hold, so the learner pays nothing. */
export async function reportNoShow(viewer: Viewer, id: string) {
  const b = await partyBooking(viewer, id, "learner");
  if (b.status !== "authorized")
    throw new RouteError(409, "Only a held booking can be cancelled for a no-show.", "bad_state");
  try {
    await voidBooking(deps(), id, "Tutor didn't show");
  } catch (err) {
    paypalFailed(err);
  }
}

export const disputeBody = z.object({
  reason: z.string().trim().min(5, "Say what went wrong in a few words.").max(400),
});

/** Either side reports a problem: the hold freezes until an admin decides (F17-FR5). */
export async function disputeBooking(viewer: Viewer, id: string, reason: string) {
  const b = await partyBooking(viewer, id);
  const changed = await bookingStep(createAdminClient(), b.id, "disputed", null, reason);
  if (!changed) throw new RouteError(409, "Only a held booking can be disputed.", "bad_state");
}

export async function resolveDispute(id: string, outcome: "release" | "refund") {
  try {
    if (outcome === "release") await releaseBooking(deps(), id, "admin");
    else await voidBooking(deps(), id, "Refunded after review");
  } catch (err) {
    paypalFailed(err);
  }
}

/** A tutor added their PayPal email: pay the sessions already released to them. */
export async function payTutorsWaitingFor(userId: string) {
  const db = createAdminClient();
  const { data } = await db.from("tutoring_bookings").select("*").eq("tutor_id", userId).eq("status", "captured");
  for (const b of data ?? []) await payTutor({ db, paypal: getPaypal() }, b);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type BookingView = {
  id: string;
  role: "learner" | "tutor";
  status: string;
  concept: { id: string; title: string };
  other: string;
  startsAt: string;
  minutes: number;
  price: string;
  tutorShare: string;
  commission: string;
  proposedBy: string;
  agentReason: string | null;
  note: string | null;
  releasedBy: string | null;
  tutorPayoutStatus: string | null;
  autoReleaseAt: string;
};

async function views(viewer: Viewer, rows: Booking[]): Promise<BookingView[]> {
  if (!rows.length) return [];
  const admin = createAdminClient();
  const people = [...new Set(rows.flatMap((b) => [b.learner_id, b.tutor_id]))];
  const [{ data: names }, { data: concepts }, cfg] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", people),
    admin
      .from("concepts")
      .select("id, title")
      .in("id", [...new Set(rows.map((b) => b.concept_id))]),
    getConfig("tutoring"),
  ]);
  const name = (id: string) => names?.find((n) => n.id === id)?.display_name ?? "A student";
  return rows.map((b) => {
    const share = tutorShareCents(b.price_cents, b.take_rate_bp);
    const role = b.learner_id === viewer.userId ? "learner" : "tutor";
    return {
      id: b.id,
      role,
      status: b.status,
      concept: { id: b.concept_id, title: concepts?.find((c) => c.id === b.concept_id)?.title ?? "Topic" },
      other: name(role === "learner" ? b.tutor_id : b.learner_id),
      startsAt: b.starts_at,
      minutes: b.minutes,
      price: usd(b.price_cents),
      tutorShare: usd(share),
      commission: usd(b.price_cents - share),
      proposedBy: b.proposed_by,
      agentReason: b.agent_reason,
      note: b.note,
      releasedBy: b.released_by,
      tutorPayoutStatus: b.tutor_payout_status,
      autoReleaseAt: autoReleaseAt(b, cfg.auto_release_hours).toISOString(),
    };
  });
}

export async function myBookings(viewer: Viewer): Promise<BookingView[]> {
  const { data } = await (
    await createClient()
  )
    .from("tutoring_bookings")
    .select("*")
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(40);
  return views(
    viewer,
    (data ?? []).filter((b) => b.status !== "cancelled" || b.learner_id === viewer.userId),
  );
}

export async function bookingView(viewer: Viewer, id: string): Promise<BookingView | null> {
  const { data } = await (await createClient()).from("tutoring_bookings").select("*").eq("id", id).maybeSingle();
  return data ? ((await views(viewer, [data]))[0] ?? null) : null;
}

export type AdminBooking = BookingView & {
  learner: string;
  tutor: string;
  createdAt: string;
  tutorPayout: string | null;
};

/** Every booking for the admin's Tutoring table (newest first), with both people's names. */
export async function adminBookings(): Promise<AdminBooking[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tutoring_bookings")
    .select("*")
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = data ?? [];
  const { data: names } = rows.length
    ? await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", [...new Set(rows.flatMap((b) => [b.learner_id, b.tutor_id]))])
    : { data: [] as { id: string; display_name: string | null }[] };
  const name = (id: string) => names?.find((n) => n.id === id)?.display_name ?? "A student";
  const list = await views({ userId: "" } as Viewer, rows);
  return list.map((v, i) => ({
    ...v,
    learner: name(rows[i]!.learner_id),
    tutor: name(rows[i]!.tutor_id),
    createdAt: rows[i]!.created_at,
    tutorPayout: rows[i]!.tutor_payout_status,
  }));
}
