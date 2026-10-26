import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { startRun } from "@/lib/labs/service";

// POST /api/labs/:id/run — a new run: a seed and the readings the apparatus gives for it. The true
// constants never leave the server.
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/labs/[id]/run">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  return NextResponse.json(await startRun(viewer, id));
});
