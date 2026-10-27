import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { reportBody, reportExplainer } from "@/lib/contribute/explainers";

// POST /api/explainers/:id/report — a student reports an explainer; 3 from different students hide
// it until an admin looks at it (08 §7b, 12 §4 Q58).
export const POST = route(async (request: Request, ctx: RouteContext<"/api/explainers/[id]/report">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  const { reason } = await parseJson(request, reportBody);
  return NextResponse.json(await reportExplainer(viewer, id, reason));
});
