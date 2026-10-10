import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { createCourse, createCourseInput, searchCourses } from "@/lib/courses/service";

// GET /api/courses?q=… — courses at the student's university (F2-FR1, 07 §5.1b).
export const GET = route(async (request: Request) => {
  const viewer = await requireAdult();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ courses: await searchCourses(viewer, q.trim()) });
});

// POST /api/courses — create a course (normalised code, near-duplicates first, moderation, 5/day).
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  const input = await parseJson(request, createCourseInput);
  const result = await createCourse(viewer, input);
  return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 });
});
