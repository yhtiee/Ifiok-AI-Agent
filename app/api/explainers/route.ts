import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { createExplainer, createExplainerBody } from "@/lib/contribute/explainers";

// POST /api/explainers — a new explainer (F18). Written ones go straight to review; voice and video
// come back with signed upload URLs for the private bucket, then POST …/submit.
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  const body = await parseJson(request, createExplainerBody);
  return NextResponse.json(await createExplainer(viewer, body), { status: 201 });
});
