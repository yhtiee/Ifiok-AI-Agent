import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { shareBody, shareMaterial } from "@/lib/contribute/share";

// POST /api/materials/:id/share — share the student's own material to the contribution pool
// (F11, 10 MVP-06). It's checked in the background: approved, held or rejected with a reason.
export const POST = route(async (request: Request, ctx: RouteContext<"/api/materials/[id]/share">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  await parseJson(request, shareBody);
  return NextResponse.json(await shareMaterial(viewer, id), { status: 202 });
});
