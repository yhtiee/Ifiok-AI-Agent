import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { completeLibraryUpload } from "@/lib/contribute/library-upload";

// POST /api/library/upload/:id/complete — the PDF and thumbnail are uploaded: check and attach them.
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/library/upload/[id]/complete">) => {
  const viewer = await requireAdult();
  return NextResponse.json(await completeLibraryUpload(viewer, requireUuid((await ctx.params).id)));
});
