import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { examDateBody, setExamDate } from "@/lib/exam/service";

// PUT /api/courses/:id/exam/date — the student's exam date; the study plan is built from it.
export const PUT = route(async (request: Request, ctx: RouteContext<"/api/courses/[id]/exam/date">) => {
  const viewer = await requireAdult();
  const courseId = requireUuid((await ctx.params).id);
  const { exam_date } = await parseJson(request, examDateBody);
  await setExamDate(viewer, courseId, exam_date);
  return NextResponse.json({ saved: true });
});
