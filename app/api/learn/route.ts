import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { learnTopic } from "@/lib/courses/service";
import { getLessonState } from "@/lib/lessons/service";

const body = z.object({ topic: z.string().trim().min(2).max(120) });

// POST /api/learn — learn any topic, with or without a course (F2-FR1). The topic resolves to a
// shared concept the student follows; too-broad topics get narrower suggestions. The response
// says where the concept's lesson stands; /learn/:conceptId starts generation if needed (F2-FR4).
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  const { topic } = await parseJson(request, body);
  const result = await learnTopic(viewer, topic);
  if (result.status === "too_broad") {
    return NextResponse.json(result, { status: 422 });
  }
  const lesson = await getLessonState(result.concept.id);
  return NextResponse.json({ ...result, lesson });
});
