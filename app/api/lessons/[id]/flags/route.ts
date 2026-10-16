import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { flagLessonBlock } from "@/lib/lessons/service";

const flagBody = z.object({
  blockId: z.string().min(1).max(80),
  reason: z.enum(["wrong", "unclear", "offensive", "other"]),
  note: z.string().max(500).optional(),
});

type Params = { params: Promise<{ id: string }> };

// POST /api/lessons/:id/flags — Flag a specific block (F2-FR6 quality loop)
export const POST = route(async (req: Request, { params }: Params) => {
  const viewer = await requireAdult();
  const { id } = await params;
  const input = await parseJson(req, flagBody);

  const result = await flagLessonBlock(viewer, id, input);
  return NextResponse.json({ status: "flagged", ...result }, { status: 201 });
});
