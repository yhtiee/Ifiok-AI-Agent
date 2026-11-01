import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPaypal } from "@ifiok/core/payments/paypal";

// MVP-07 against the real PayPal sandbox (pnpm test:integration; test money only). Skips until
// PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV=sandbox are set. PAYPAL_TEST_RECEIVER is a
// sandbox personal account's email (OWN-H8). The buyer's approval of a tutoring order needs a
// browser, so the order test checks the order is created for approval; capture and void are
// covered by the booking flow in the app and the unit tests.

const ready = Boolean(
  process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_ENV === "sandbox",
);
const paypal = () =>
  createPaypal({
    clientId: process.env.PAYPAL_CLIENT_ID!,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
    env: process.env.PAYPAL_ENV,
  });

describe.skipIf(!ready)("PayPal sandbox (live)", () => {
  it("creates a tutoring order to authorise, with an approval link", async () => {
    const out = await paypal().createAuthorizeOrder({
      amountCents: 500,
      description: "Ifiok integration test",
      customId: randomUUID(),
      returnUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/no",
    });
    expect(out.orderId).toBeTruthy();
    expect(out.approveUrl).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\//);
    const order = await paypal().getOrder(out.orderId);
    expect(order.status).toMatch(/CREATED|PAYER_ACTION_REQUIRED/);
  });

  it.skipIf(!process.env.PAYPAL_TEST_RECEIVER)(
    "a payout batch reaches the receiver, and the same batch id isn't paid twice",
    async () => {
      const batch = `itest-${randomUUID()}`;
      const item = {
        receiver: process.env.PAYPAL_TEST_RECEIVER!,
        amountCents: 101,
        senderItemId: `line:${randomUUID()}`,
        note: "Ifiok test",
      };
      const first = await paypal().createPayout(batch, "Ifiok test payout", [item]);
      // Same request id: PayPal answers with the same batch instead of paying again.
      const again = await paypal()
        .createPayout(batch, "Ifiok test payout", [item])
        .catch((e: unknown) => e);
      if (!(again instanceof Error)) expect((again as { batchId: string }).batchId).toBe(first.batchId);
      let status = "";
      for (let i = 0; i < 20 && !["SUCCESS", "UNCLAIMED"].includes(status); i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const items = (await paypal().getPayoutBatch(first.batchId)).items;
        expect(items).toHaveLength(1);
        status = items[0]?.transaction_status ?? "";
      }
      expect(["SUCCESS", "UNCLAIMED"]).toContain(status);
    },
    90_000,
  );
});
