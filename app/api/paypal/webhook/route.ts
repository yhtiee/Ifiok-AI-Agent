import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { handlePaypalWebhook } from "@/lib/payments/webhook";

// POST /api/paypal/webhook — PayPal sandbox events (08 §2.7c). No session: PayPal's signature,
// checked by PayPal's own API on the raw body, is the authentication.
export const POST = route(async (request: Request) => {
  const raw = await request.text();
  const out = await handlePaypalWebhook(request.headers, raw);
  return NextResponse.json({ handled: out.handled }, { status: out.status });
});
