import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { completeMaterial } from "@/lib/materials/service";

// POST /api/materials/:id/complete — the file is uploaded: check it, attach it, read any photos or
// scanned pages (12 §4 Q60).
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/materials/[id]/complete">) => {
  const viewer = await requireAdult();
  return NextResponse.json(await completeMaterial(viewer, requireUuid((await ctx.params).id)));
});
