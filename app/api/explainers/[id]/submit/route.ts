import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { submitExplainer } from "@/lib/contribute/explainers";

// POST /api/explainers/:id/submit — the recording is uploaded: check it arrived and send it for review.
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/explainers/[id]/submit">) => {
  const viewer = await requireAdult();
  return NextResponse.json(await submitExplainer(viewer, requireUuid((await ctx.params).id)));
});
