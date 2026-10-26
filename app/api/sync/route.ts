import { after, NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { explainWrongAnswers, syncBody, syncEvidence } from "@/lib/learning/sync";

// POST /api/sync — answers and finished lesson screens (10 MVP-03, guardrail 6). The server
// re-marks every answer, records it once per client UUID and updates mastery; wrong answers are
// explained and tagged after the response is sent.
export const POST = route(async (request: Request) => {
  const viewer = await requireAdult();
  const body = await parseJson(request, syncBody);
  const { result, explain } = await syncEvidence(viewer, body);
  if (explain.length) after(() => explainWrongAnswers(viewer, explain));
  return NextResponse.json(result);
});
