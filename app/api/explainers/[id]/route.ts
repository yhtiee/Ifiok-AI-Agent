import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { withdrawExplainer } from "@/lib/contribute/explainers";

// DELETE /api/explainers/:id — the author withdraws their explainer; its media is deleted.
export const DELETE = route(async (_request: Request, ctx: RouteContext<"/api/explainers/[id]">) => {
  const viewer = await requireAdult();
  await withdrawExplainer(viewer, requireUuid((await ctx.params).id));
  return NextResponse.json({ withdrawn: true });
});
