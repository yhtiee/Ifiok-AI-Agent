import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { explainLine } from "@/lib/payments/payouts";

// POST /api/payouts/:id/explain — "Why this amount": the AI explains a payout line in plain words
// from the recorded numbers (10 MVP-07). Kept once written.
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/payouts/[id]/explain">) => {
  const viewer = await requireAdult();
  const text = await explainLine(viewer, requireUuid((await ctx.params).id));
  return NextResponse.json({ text });
});
