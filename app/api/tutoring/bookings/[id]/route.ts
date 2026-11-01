import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { authorizeBooking, cancelBooking, confirmBooking, disputeBooking, reportNoShow } from "@/lib/payments/tutoring";

const actionBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("authorize") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("no_show") }),
  z.object({
    action: z.literal("dispute"),
    reason: z.string().trim().min(5, "Say what went wrong in a few words.").max(400),
  }),
]);

// POST /api/tutoring/bookings/:id — the learner's steps (F17-FR4, FR5): authorise after PayPal
// approval, cancel before paying, confirm the session (capture + pay the tutor), report a tutor
// no-show (void), or report a problem (either side; freezes the hold for an admin).
export const POST = route(async (request: Request, ctx: RouteContext<"/api/tutoring/bookings/[id]">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  const body = await parseJson(request, actionBody);
  if (body.action === "authorize") return NextResponse.json(await authorizeBooking(viewer, id));
  if (body.action === "cancel") await cancelBooking(viewer, id);
  else if (body.action === "confirm") await confirmBooking(viewer, id);
  else if (body.action === "no_show") await reportNoShow(viewer, id);
  else await disputeBooking(viewer, id, body.reason);
  return NextResponse.json({ saved: true });
});
