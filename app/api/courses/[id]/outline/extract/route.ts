import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route, RouteError } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { extractOutline, OUTLINE_FILE_MAX_BYTES, OUTLINE_FILE_TYPES } from "@/lib/courses/service";

// POST /api/courses/:id/outline/extract — read topics from a photo or PDF of the outline
// (scheme_extract). The file is sent to the AI and then discarded: Ifiok doesn't store it.
export const POST = route(async (request: Request, ctx: RouteContext<"/api/courses/[id]/outline/extract">) => {
  const viewer = await requireAdult();
  const courseId = requireUuid((await ctx.params).id);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new RouteError(422, "Choose a photo or PDF of the course outline.", "no_file");
  if (!(OUTLINE_FILE_TYPES as readonly string[]).includes(file.type)) {
    throw new RouteError(422, "Use a photo (JPG or PNG) or a PDF.", "bad_type");
  }
  if (file.size > OUTLINE_FILE_MAX_BYTES) {
    throw new RouteError(422, "That file is over 8 MB. Take a closer photo or use a smaller PDF.", "too_big");
  }

  const result = await extractOutline(viewer, courseId, {
    mime: file.type as (typeof OUTLINE_FILE_TYPES)[number],
    data: new Uint8Array(await file.arrayBuffer()),
  });
  return NextResponse.json(result);
});
