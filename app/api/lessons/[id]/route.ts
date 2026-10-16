import { NextResponse } from "next/server";
import { z } from "zod";
import { lessonSpecSchema } from "@ifiok/core";
import { parseJson } from "@/lib/api/input";
import { RouteError, route } from "@/lib/api/route";
import { requireAdult, requireUser } from "@/lib/auth/guards";
import { curateLesson, getLesson } from "@/lib/lessons/service";

const patchBody = z.object({
  spec: lessonSpecSchema,
});

type Params = { params: Promise<{ id: string }> };

// GET /api/lessons/:id — Fetch lesson by ID
export const GET = route(async (_req: Request, { params }: Params) => {
  await requireUser();
  const { id } = await params;
  const lesson = await getLesson(id);

  if (!lesson) {
    throw new RouteError(404, "Lesson not found.", "lesson_not_found");
  }

  return NextResponse.json(lesson);
});

// PATCH /api/lessons/:id — Curate/edit a lesson (F2-FR6)
export const PATCH = route(async (req: Request, { params }: Params) => {
  const viewer = await requireAdult();
  const { id } = await params;
  const { spec } = await parseJson(req, patchBody);

  const updated = await curateLesson(viewer, id, spec);
  return NextResponse.json(updated);
});
