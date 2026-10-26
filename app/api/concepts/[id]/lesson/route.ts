import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson } from "@/lib/api/input";
import { RouteError, route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { getLessonState, startLessonForConcept } from "@/lib/lessons/service";

type Params = { params: Promise<{ id: string }> };

const conceptId = z.string().uuid();
const body = z.object({ course_id: z.string().uuid().optional() });

function parseId(id: string) {
  const parsed = conceptId.safeParse(id);
  if (!parsed.success)
    throw new RouteError(404, "That topic doesn't exist. Search for it again from Courses.", "concept_not_found");
  return parsed.data;
}

// GET /api/concepts/:id/lesson[?course=…]: where the lesson this student should see stands: their
// own lesson from their materials, else the shared one (F2-FR4, MVP-02). Read-only.
export const GET = route(async (req: Request, { params }: Params) => {
  const viewer = await requireAdult();
  const id = parseId((await params).id);
  const course = conceptId.safeParse(new URL(req.url).searchParams.get("course"));
  return NextResponse.json(await getLessonState(id, { viewer, courseId: course.success ? course.data : null }));
});

// POST /api/concepts/:id/lesson: open the lesson, starting (or retrying) generation if needed.
export const POST = route(async (req: Request, { params }: Params) => {
  const viewer = await requireAdult();
  const id = parseId((await params).id);
  const { course_id } = await parseJson(req, body);
  return NextResponse.json(await startLessonForConcept(viewer, id, course_id));
});
