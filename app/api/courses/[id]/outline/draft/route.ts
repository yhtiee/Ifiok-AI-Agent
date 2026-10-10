import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { draftOutline } from "@/lib/courses/service";

// POST /api/courses/:id/outline/draft — an AI draft for the student to check (outline_draft).
// Nothing is saved until the student saves the outline.
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/courses/[id]/outline/draft">) => {
  const viewer = await requireAdult();
  const topics = await draftOutline(viewer, requireUuid((await ctx.params).id));
  return NextResponse.json({ topics });
});
