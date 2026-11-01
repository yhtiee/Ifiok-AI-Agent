import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireReviewAdmin } from "@/lib/auth/guards";
import { refreshPeriod, retryFailed, sendPayouts } from "@/lib/payments/payouts";

const body = z.object({ action: z.enum(["send", "refresh", "retry"]).default("send") });

// POST /api/admin/payouts/:id/send — send a closed month's payouts as one PayPal (sandbox) batch;
// { action: "refresh" } reads the items' status from PayPal; { action: "retry" } reopens failed lines.
export const POST = route(async (request: Request, ctx: RouteContext<"/api/admin/payouts/[id]/send">) => {
  await requireReviewAdmin();
  const id = requireUuid((await ctx.params).id);
  const { action } = await parseJson(request, body);
  if (action === "refresh") return NextResponse.json(await refreshPeriod(id));
  if (action === "retry") return NextResponse.json(await retryFailed(id));
  return NextResponse.json(await sendPayouts(id));
});
