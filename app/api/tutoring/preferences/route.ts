import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { limitBody, setSpendLimit } from "@/lib/payments/agent";

// PUT /api/tutoring/preferences — the most Ifiok's agent may propose for one session.
export const PUT = route(async (request: Request) => {
  const viewer = await requireAdult();
  const body = await parseJson(request, limitBody);
  await setSpendLimit(viewer, body.spend_limit_cents);
  return NextResponse.json({ saved: true });
});
