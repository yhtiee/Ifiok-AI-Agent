import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireReviewAdmin } from "@/lib/auth/guards";
import { resolveDispute } from "@/lib/payments/tutoring";

// POST /api/admin/bookings/:id — decide a disputed booking: pay the tutor or refund the learner.
export const POST = route(async (request: Request, ctx: RouteContext<"/api/admin/bookings/[id]">) => {
  await requireReviewAdmin();
  const body = await parseJson(request, z.object({ outcome: z.enum(["release", "refund"]) }));
  await resolveDispute(requireUuid((await ctx.params).id), body.outcome);
  return NextResponse.json({ saved: true });
});
