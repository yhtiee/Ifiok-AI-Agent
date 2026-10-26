import { NextResponse } from "next/server";
import { z } from "zod";
import { MATERIAL_LIMITS } from "@ifiok/core/materials/kinds";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route, RouteError } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { extractOutline, OUTLINE_FILE_MAX_BYTES, OUTLINE_FILE_TYPES } from "@/lib/courses/service";
import { redactPersonalData } from "@ifiok/core/ai/redact";

const textBody = z.object({
  text: z.string().trim().min(20, "add the outline's text").max(MATERIAL_LIMITS.maxOutlineChars),
});

// POST /api/courses/:id/outline/extract — read topics from the outline (scheme_extract). Either
// JSON `{ text }` from pages picked on the device (MVP-01, F3: only text is sent), or a photo or
// PDF as form data. Nothing is stored: the file or text goes to the AI and is then discarded.
export const POST = route(async (request: Request, ctx: RouteContext<"/api/courses/[id]/outline/extract">) => {
  const viewer = await requireAdult();
  const courseId = requireUuid((await ctx.params).id);

  if (request.headers.get("content-type")?.includes("application/json")) {
    const { text } = await parseJson(request, textBody);
    const result = await extractOutline(viewer, courseId, { text: redactPersonalData(text).text });
    return NextResponse.json(result);
  }

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
    file: {
      mime: file.type as (typeof OUTLINE_FILE_TYPES)[number],
      data: new Uint8Array(await file.arrayBuffer()),
    },
  });
  return NextResponse.json(result);
});
