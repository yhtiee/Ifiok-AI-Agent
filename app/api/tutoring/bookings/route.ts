import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { bookingBody, createBooking } from "@/lib/payments/tutoring";

// POST /api/tutoring/bookings — book a tutor (F17): creates the PayPal (sandbox) order and returns
// where to approve it. Nothing is held until the learner approves; nothing is captured until later.
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  const body = await parseJson(request, bookingBody);
  return NextResponse.json(await createBooking(viewer, body, new URL(request.url).origin), { status: 201 });
});
