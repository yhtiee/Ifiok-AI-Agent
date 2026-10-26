import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { getCoursePath } from "@/lib/courses/path";

// GET /api/courses/:id/path — the viewer's Path through the course (MVP-02): topics in order with
// lesson state, mastery and practice count, and "Next up".
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/courses/[id]/path">) => {
  const viewer = await requireAdult();
  const courseId = requireUuid((await ctx.params).id);
  return NextResponse.json(await getCoursePath(viewer, courseId));
});
