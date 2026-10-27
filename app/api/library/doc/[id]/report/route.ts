import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { reportDocBody, reportDocument } from "@/lib/contribute/library";

// POST /api/library/doc/:id/report — 3 reports from different students send a document to an admin.
export const POST = route(async (request: Request, ctx: RouteContext<"/api/library/doc/[id]/report">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  const { reason } = await parseJson(request, reportDocBody);
  return NextResponse.json(await reportDocument(viewer, id, reason));
});
