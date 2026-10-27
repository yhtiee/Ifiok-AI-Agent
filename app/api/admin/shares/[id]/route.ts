import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireReviewAdmin } from "@/lib/auth/guards";
import { decideShare, decisionBody } from "@/lib/contribute/explainers";

// POST /api/admin/shares/:id — approve or reject shared material the checks held for a person.
export const POST = route(async (request: Request, ctx: RouteContext<"/api/admin/shares/[id]">) => {
  const viewer = await requireReviewAdmin();
  const id = requireUuid((await ctx.params).id);
  await decideShare(viewer, id, await parseJson(request, decisionBody));
  return NextResponse.json({ saved: true });
});
