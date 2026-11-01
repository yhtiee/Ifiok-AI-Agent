import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { dismissProposal } from "@/lib/payments/agent";

// DELETE /api/tutoring/agent/:id — "Not now": dismiss the agent's draft.
export const DELETE = route(async (_request: Request, ctx: RouteContext<"/api/tutoring/agent/[id]">) => {
  const viewer = await requireAdult();
  await dismissProposal(viewer, requireUuid((await ctx.params).id));
  return NextResponse.json({ saved: true });
});
