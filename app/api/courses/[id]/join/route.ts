import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { joinCourse, leaveCourse } from "@/lib/courses/service";

// POST joins a course; DELETE leaves it.
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/courses/[id]/join">) => {
  const viewer = await requireAdult();
  await joinCourse(viewer, requireUuid((await ctx.params).id));
  return NextResponse.json({ joined: true });
});

export const DELETE = route(async (_request: Request, ctx: RouteContext<"/api/courses/[id]/join">) => {
  const viewer = await requireAdult();
  await leaveCourse(viewer, requireUuid((await ctx.params).id));
  return NextResponse.json({ joined: false });
});
