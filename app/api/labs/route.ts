import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { requestLab, requestLabBody } from "@/lib/labs/service";

// POST /api/labs — "Request a lab": a practical someone already built is added at once; otherwise
// lab_extract builds it in the background (10 MVP-05).
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  const body = await parseJson(request, requestLabBody);
  const result = await requestLab(viewer, body);
  return NextResponse.json(result, { status: result.status === "added" ? 200 : 202 });
});
