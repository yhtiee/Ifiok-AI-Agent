import "server-only";
import { z } from "zod";
import { bookingStep, loadBooking, payTutor } from "@ifiok/core/payments/tutoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaypal } from "./paypal";

// PayPal webhooks (08 §2.7c, guardrail 12's pattern): verify the signature on the raw body with
// PayPal's verify-webhook-signature API, then fetch the payout item, authorisation or capture
// from PayPal (never trust the event body), then post through an idempotent SQL function keyed on
// the PayPal id. An event id already handled is acknowledged and ignored.

const eventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  resource: z.object({ id: z.string().optional(), payout_item_id: z.string().optional() }).passthrough(),
});

export type WebhookResult = { status: number; handled: string };

export async function handlePaypalWebhook(headers: Headers, raw: string): Promise<WebhookResult> {
  const paypal = getPaypal();
  if (!(await paypal.verifyWebhook(headers, raw))) return { status: 400, handled: "bad_signature" };
  const parsed = eventSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return { status: 200, handled: "ignored" };
  const event = parsed.data;
  const db = createAdminClient();

  const { data: seen } = await db.from("paypal_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (seen) return { status: 200, handled: "replay" };

  const type = event.event_type;
  if (type.startsWith("PAYMENT.PAYOUTS-ITEM.") && event.resource.payout_item_id) {
    const item = await paypal.getPayoutItem(event.resource.payout_item_id);
    const [kind, id] = (item.payout_item.sender_item_id ?? "").split(":");
    const status = item.transaction_status ?? "PENDING";
    if (kind === "line" && id)
      await db.rpc("record_payout_item", { p_line: id, p_item_id: item.payout_item_id, p_paypal_status: status });
    else if (kind === "booking" && id)
      await db.rpc("record_tutor_payout", { p_booking: id, p_item_id: item.payout_item_id, p_paypal_status: status });
  } else if (type.startsWith("PAYMENT.AUTHORIZATION.") && event.resource.id) {
    const auth = await paypal.getAuthorization(event.resource.id);
    if (auth.custom_id) {
      if (auth.status === "CREATED" || auth.status === "PENDING") {
        if (await bookingStep(db, auth.custom_id, "authorized", auth.id)) {
          const b = await loadBooking(db, auth.custom_id);
          await db.rpc("enqueue_job_once", {
            p_queue: "tutoring_release",
            p_payload: { booking_id: auth.custom_id },
            p_dedupe: `release:${auth.custom_id}`,
            p_owner: b?.learner_id as string,
          });
        }
      } else if (auth.status === "VOIDED") {
        await bookingStep(db, auth.custom_id, "voided", null, "Voided on PayPal");
      }
    }
  } else if (type === "PAYMENT.CAPTURE.COMPLETED" && event.resource.id) {
    const capture = await paypal.getCapture(event.resource.id);
    if (capture.custom_id && capture.status === "COMPLETED") {
      await bookingStep(db, capture.custom_id, "captured", capture.id, "auto");
      const b = await loadBooking(db, capture.custom_id);
      if (b?.status === "captured") await payTutor({ db, paypal }, b);
    }
  }

  await db.rpc("paypal_event_once", { p_event_id: event.id, p_type: type });
  return { status: 200, handled: type };
}
