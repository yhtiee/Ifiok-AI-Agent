import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";

// Placeholder AI endpoint (P0-04 "Done when": a non-adult profile gets 403 from an AI route).
// Shows the guard every AI route must run first. Removed when the gateway lands (P0-10).
export const GET = route(async () => {
  await requireAdult();
  return NextResponse.json({ ok: true });
});
