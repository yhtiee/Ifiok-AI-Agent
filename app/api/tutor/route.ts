import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { saveTutorProfile, tutorBody } from "@/lib/contribute/tutor";

// PUT /api/tutor — the student's tutor profile: topics and availability (F17-FR1, no bookings yet).
export const PUT = route(async (request: Request) => {
  const viewer = await requireAdult();
  await saveTutorProfile(viewer, await parseJson(request, tutorBody));
  return NextResponse.json({ saved: true });
});
