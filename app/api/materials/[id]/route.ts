import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { deleteMaterial } from "@/lib/materials/service";

// DELETE /api/materials/:id — delete the viewer's own private materials and their chunks.
export const DELETE = route(async (_request: Request, ctx: RouteContext<"/api/materials/[id]">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  await deleteMaterial(viewer, id);
  return NextResponse.json({ deleted: true });
});
