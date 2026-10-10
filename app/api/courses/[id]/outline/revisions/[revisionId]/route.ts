import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, requireUuid } from "@/lib/api/input";
import { route, RouteError } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { decideRevision } from "@/lib/courses/service";

const body = z.object({ action: z.enum(["confirm", "reject", "revert"]) });

// POST /api/courses/:id/outline/revisions/:revisionId — confirm or reject a pending edit, or
// restore an earlier version (wiki history, F2-FR2).
export const POST = route(
  async (request: Request, ctx: RouteContext<"/api/courses/[id]/outline/revisions/[revisionId]">) => {
    const viewer = await requireAdult();
    const { id, revisionId } = await ctx.params;
    const revision = Number(revisionId);
    if (!Number.isSafeInteger(revision) || revision <= 0) throw new RouteError(404, "Not found.", "not_found");
    const { action } = await parseJson(request, body);
    return NextResponse.json(await decideRevision(viewer, requireUuid(id), revision, action));
  },
);
