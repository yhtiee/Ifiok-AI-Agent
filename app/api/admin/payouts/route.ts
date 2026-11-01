import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireReviewAdmin } from "@/lib/auth/guards";
import { closeMonth, closeMonthBody } from "@/lib/payments/payouts";

// POST /api/admin/payouts — close a month: split the sandbox-funded pool by usage points (06 §3).
export const POST = route(async (request: Request) => {
  await requireReviewAdmin();
  const body = await parseJson(request, closeMonthBody);
  return NextResponse.json({ periodId: await closeMonth(body.month, body.pool_cents) }, { status: 201 });
});
