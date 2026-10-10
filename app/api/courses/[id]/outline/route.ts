import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { saveOutline, saveOutlineInput } from "@/lib/courses/service";

// PUT /api/courses/:id/outline — save the full ordered topic list (F2-FR2). Topics are resolved to
// concepts; the edit applies at once or waits for another member to confirm (08 §2.5b).
export const PUT = route(async (request: Request, ctx: RouteContext<"/api/courses/[id]/outline">) => {
  const viewer = await requireAdult();
  const courseId = requireUuid((await ctx.params).id);
  const input = await parseJson(request, saveOutlineInput);
  const result = await saveOutline(viewer, courseId, input);
  return NextResponse.json(result, { status: result.status === "too_broad" ? 422 : 200 });
});
