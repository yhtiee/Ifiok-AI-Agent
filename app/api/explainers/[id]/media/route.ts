import { NextResponse } from "next/server";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { mediaBody, mediaUrl } from "@/lib/contribute/explainers";

// POST /api/explainers/:id/media — a short-lived playback URL for the audio or the video, asked for
// only when the student taps play or "Load video" (data-saver never asks for the video).
export const POST = route(async (request: Request, ctx: RouteContext<"/api/explainers/[id]/media">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  const { part } = await parseJson(request, mediaBody);
  return NextResponse.json(await mediaUrl(viewer, id, part));
});
