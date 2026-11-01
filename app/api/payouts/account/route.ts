import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api/input";
import { route } from "@/lib/api/route";
import { requireAdult } from "@/lib/auth/guards";
import { payoutAccountBody, removePayoutAccount, savePayoutAccount } from "@/lib/payments/payouts";

// PUT /api/payouts/account — the PayPal (sandbox) email Ifiok pays you at. DELETE removes it.
export const PUT = route(async (request: Request) => {
  const viewer = await requireAdult();
  const body = await parseJson(request, payoutAccountBody);
  await savePayoutAccount(viewer, body.paypal_email);
  return NextResponse.json({ saved: true });
});

export const DELETE = route(async () => {
  const viewer = await requireAdult();
  await removePayoutAccount(viewer);
  return NextResponse.json({ saved: true });
});
