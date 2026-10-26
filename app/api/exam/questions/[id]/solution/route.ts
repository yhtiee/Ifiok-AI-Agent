import { NextResponse } from "next/server";
import { requireUuid } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { mathHtmlFor } from "@/lib/exam/math";
import { getWorkedSolution } from "@/lib/exam/service";

// POST /api/exam/questions/:id/solution — the question's worked solution: generated the first time
// a member asks, then shared in the course. Maths comes back pre-rendered (no KaTeX in the browser).
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/exam/questions/[id]/solution">) => {
  const viewer = await requireAdult();
  const id = requireUuid((await ctx.params).id);
  const solution = await getWorkedSolution(viewer, id);
  const math = mathHtmlFor(
    [...solution.steps.map((s) => s.text), solution.final.text],
    solution.steps.flatMap((s) => (s.latex ? [s.latex] : [])),
  );
  return NextResponse.json({ solution, math });
});
