import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { learnTopic } from "@/lib/courses/service";

const body = z.object({ topic: z.string().trim().min(2).max(120) });

// POST /api/learn — learn any topic, with or without a course (F2-FR1). The topic resolves to a
// shared concept the student follows; too-broad topics get narrower suggestions.
// P1-02 extends this to open or build the concept's lesson.
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  const { topic } = await parseJson(request, body);
  const result = await learnTopic(viewer, topic);
  return NextResponse.json(result, { status: result.status === "too_broad" ? 422 : 200 });
});
