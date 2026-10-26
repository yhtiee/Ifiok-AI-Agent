import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { compareBody, compareLab } from "@/lib/labs/service";

// POST /api/labs/:id/compare — the student's result against the accepted value, with the reasons
// for any gap; the readings are regenerated from the seed and the run is saved (05 §9).
export const POST = route(async (request: Request, ctx: RouteContext<"/api/labs/[id]/compare">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  const body = await parseJson(request, compareBody);
  return NextResponse.json(await compareLab(viewer, id, body));
});
