import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route, RouteError } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { createMaterial, createMaterialBody, listMaterials, parseScope } from "@/lib/materials/service";

/** 80 pages of dense text is about 1 MB of JSON; anything far bigger isn't from our page picker. */
const MAX_BODY_BYTES = 2_000_000;

// GET /api/materials?courseId=…|conceptId=… — the viewer's own materials there, with status.
export const GET = route(async (request: Request) => {
  const viewer = await requireAdult();
  const params = new URL(request.url).searchParams;
  const scope = parseScope({ courseId: params.get("courseId"), conceptId: params.get("conceptId") });
  return NextResponse.json({ materials: await listMaterials(viewer, scope) });
});

// POST /api/materials — the text of pages picked on the device (F3: no file is sent or stored).
// Personal details are stripped, the text is chunked into a private source, and `embed` is queued.
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    throw new RouteError(413, "That's too much text for one upload. Pick fewer pages.", "too_big");
  }
  const body = await parseJson(request, createMaterialBody);
  return NextResponse.json(await createMaterial(viewer, body), { status: 201 });
});
