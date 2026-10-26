import { NextResponse } from "next/server";
import { z } from "zod";
import { route, RouteError } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { parseScope, searchMaterials } from "@/lib/materials/service";

const query = z.string().trim().min(2).max(300);

// GET /api/materials/search?courseId=…|conceptId=…&q=… — "Find in your materials" (MVP-01):
// hybrid retrieval over the viewer's own chunks there.
export const GET = route(async (request: Request) => {
  const viewer = await requireAdult();
  const params = new URL(request.url).searchParams;
  const scope = parseScope({ courseId: params.get("courseId"), conceptId: params.get("conceptId") });
  const q = query.safeParse(params.get("q") ?? "");
  if (!q.success) throw new RouteError(422, "Type at least two characters to search.", "invalid");
  return NextResponse.json({ hits: await searchMaterials(viewer, scope, q.data) });
});
