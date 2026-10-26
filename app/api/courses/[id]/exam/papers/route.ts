import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { savePaper, savePaperBody } from "@/lib/exam/service";

// POST /api/courses/:id/exam/papers — save a past paper's questions after the student reviewed the
// extraction (F8-FR1, 10 MVP-04). They are shared with the course's members (12 §4 Q53).
export const POST = route(async (request: Request, ctx: RouteContext<"/api/courses/[id]/exam/papers">) => {
  const viewer = await requireAdult();
  const courseId = requireUuid((await ctx.params).id);
  const body = await parseJson(request, savePaperBody);
  return NextResponse.json(await savePaper(viewer, courseId, body), { status: 201 });
});
