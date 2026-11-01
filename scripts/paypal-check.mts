// PayPal sandbox check (MVP-07): sends a $1.01 test payout to PAYPAL_TEST_RECEIVER and prints how
// PayPal reports the batch and item over a few minutes. Test money only; prints no secrets.
// Usage: node --experimental-transform-types scripts/paypal-check.mts [batchId]  (a batch id: only print its status)
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createPaypal } from "@ifiok/core/payments/paypal";

const env: Record<string, string> = {};
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
  }
}
const paypal = createPaypal({
  clientId: env.PAYPAL_CLIENT_ID!,
  clientSecret: env.PAYPAL_CLIENT_SECRET!,
  env: env.PAYPAL_ENV,
});

let batchId = process.argv[2];
if (!batchId) {
  const out = await paypal.createPayout(`check-${randomUUID()}`, "Ifiok sandbox check", [
    {
      receiver: env.PAYPAL_TEST_RECEIVER!,
      amountCents: 101,
      senderItemId: `check:${randomUUID()}`,
      note: "Ifiok check",
    },
  ]);
  batchId = out.batchId;
  console.log("batch", batchId, out.status);
}
for (let i = 0; i < 12; i++) {
  const items = (await paypal.getPayoutBatch(batchId)).items;
  console.log(
    new Date().toISOString().slice(11, 19),
    items.map((x) => [x.transaction_status, x.errors?.name, x.errors?.message].filter(Boolean).join(" ")).join(", "),
  );
  if (items.every((x) => x.transaction_status && !["PENDING", "ONHOLD", "NEW"].includes(x.transaction_status))) {
    for (const x of items) {
      const item = await paypal.getPayoutItem(x.payout_item_id);
      console.log("item", item.transaction_status, item.errors?.name ?? "", item.errors?.message ?? "");
    }
    break;
  }
  await new Promise((r) => setTimeout(r, 10_000));
}
