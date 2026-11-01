import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { runTutorAgent } from "@/lib/payments/agent";

// POST /api/tutoring/agent — run Ifiok's tutoring agent for the student (12 §4 Q63): it drafts a
// booking inside their spending limit. Drafting only; the student approves on PayPal to book.
export const POST = route(async () => {
  const viewer = await requireAdult();
  return NextResponse.json({ proposal: await runTutorAgent(viewer) }, { status: 201 });
});
