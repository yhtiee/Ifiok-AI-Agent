import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { finishExplainer } from "@/lib/contribute/explainers";

// POST /api/explainers/:id/finish — the student finished it (the end of the text, or ≥ 80% played):
// one usage point per (explainer, student, month) for its author, never for the author themself.
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/explainers/[id]/finish">) => {
  const viewer = await requireAdult();
  return NextResponse.json(await finishExplainer(viewer, requireUuid((await ctx.params).id)));
});
