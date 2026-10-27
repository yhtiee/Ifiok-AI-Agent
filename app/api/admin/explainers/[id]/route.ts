import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireReviewAdmin } from "@/lib/auth/guards";
import { decideExplainer, decisionBody } from "@/lib/contribute/explainers";

// POST /api/admin/explainers/:id — approve or reject an explainer (every MVP explainer, 12 §4 Q42).
export const POST = route(async (request: Request, ctx: RouteContext<"/api/admin/explainers/[id]">) => {
  const viewer = await requireReviewAdmin();
  const id = requireUuid((await ctx.params).id);
  await decideExplainer(viewer, id, await parseJson(request, decisionBody));
  return NextResponse.json({ saved: true });
});
