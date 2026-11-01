import { z } from "zod";

// PayPal sandbox client (10 MVP-07, 08 §2.7c, 12 §4 Q43): OAuth client credentials, Orders v2
// (authorise at booking, capture or void later), Payouts, and webhook signature verification.
// Plain fetch, so the Next server and the worker Edge Function share it. It refuses to run unless
// the environment is "sandbox" (test money only until Stage 3 legal review).

export const PAYPAL_SANDBOX_API = "https://api-m.sandbox.paypal.com";

export type PaypalConfig = {
  clientId: string;
  clientSecret: string;
  env: string | undefined;
  webhookId?: string;
  fetch?: typeof fetch;
};

export class PaypalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** PayPal's error name, e.g. "UNPROCESSABLE_ENTITY" or an issue code. */
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "PaypalError";
  }
}

/** "10.00" from 1000 cents. */
export const centsToValue = (cents: number) => (cents / 100).toFixed(2);
export const valueToCents = (value: string) => Math.round(Number(value) * 100);

const link = z.object({ href: z.string(), rel: z.string() });
const orderSchema = z.object({
  id: z.string(),
  status: z.string(),
  links: z.array(link).optional(),
  purchase_units: z
    .array(
      z.object({
        custom_id: z.string().optional(),
        payments: z
          .object({
            authorizations: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
            captures: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});
export type PaypalOrder = z.infer<typeof orderSchema>;

const paymentSchema = z.object({ id: z.string(), status: z.string(), custom_id: z.string().optional() });
const payoutItemSchema = z.object({
  payout_item_id: z.string(),
  transaction_status: z.string().optional(),
  payout_batch_id: z.string().optional(),
  payout_item: z.object({ sender_item_id: z.string().optional() }).passthrough(),
  /** Why PayPal failed or held the item, e.g. RECEIVER_UNREGISTERED. */
  errors: z.object({ name: z.string().optional(), message: z.string().optional() }).optional(),
});
export type PaypalPayoutItem = z.infer<typeof payoutItemSchema>;

export type PayoutItemInput = { receiver: string; amountCents: number; senderItemId: string; note: string };

export function createPaypal(config: PaypalConfig) {
  if (config.env !== "sandbox")
    throw new PaypalError("PayPal runs in the sandbox only (PAYPAL_ENV=sandbox).", 0, "not_sandbox");
  const base = config.fetch ?? fetch;
  // A network failure (DNS, reset) is retried twice. Safe for every call: GETs are reads, and every
  // POST that moves money carries a PayPal-Request-Id, so PayPal answers a repeat with the first result.
  const f: typeof fetch = async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await base(input, init);
      } catch (err) {
        if (attempt >= 2) throw err;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  };
  let token: { value: string; until: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.until > Date.now()) return token.value;
    const basic = btoa(`${config.clientId}:${config.clientSecret}`);
    const res = await f(`${PAYPAL_SANDBOX_API}/v1/oauth2/token`, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new PaypalError("PayPal didn't accept Ifiok's credentials.", res.status, "auth");
    const body = z.object({ access_token: z.string(), expires_in: z.number() }).parse(await res.json());
    token = { value: body.access_token, until: Date.now() + (body.expires_in - 60) * 1000 };
    return token.value;
  }

  async function call<T>(
    method: string,
    path: string,
    schema: z.ZodType<T> | null,
    opts: { body?: unknown; rawBody?: string; requestId?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${await accessToken()}`,
      "content-type": "application/json",
      prefer: "return=representation",
    };
    if (opts.requestId) headers["paypal-request-id"] = opts.requestId;
    const res = await f(`${PAYPAL_SANDBOX_API}${path}`, {
      method,
      headers,
      body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    });
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const e = json as { name?: string; details?: { issue?: string }[] } | null;
      throw new PaypalError(
        `PayPal ${method} ${path.split("?")[0]} failed`,
        res.status,
        e?.details?.[0]?.issue ?? e?.name ?? null,
      );
    }
    return schema ? schema.parse(json) : (json as T);
  }

  return {
    /** An order authorised (not captured) when the buyer approves: funds are held for the booking. */
    async createAuthorizeOrder(input: {
      amountCents: number;
      description: string;
      customId: string;
      returnUrl: string;
      cancelUrl: string;
    }) {
      const order = await call("POST", "/v2/checkout/orders", orderSchema, {
        requestId: `order-${input.customId}`,
        body: {
          intent: "AUTHORIZE",
          purchase_units: [
            {
              custom_id: input.customId,
              description: input.description.slice(0, 127),
              amount: { currency_code: "USD", value: centsToValue(input.amountCents) },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "Ifiok (sandbox)",
                shipping_preference: "NO_SHIPPING",
                user_action: "CONTINUE",
                return_url: input.returnUrl,
                cancel_url: input.cancelUrl,
              },
            },
          },
        },
      });
      const approve = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href ?? null;
      return { orderId: order.id, approveUrl: approve };
    },

    getOrder: (id: string) => call("GET", `/v2/checkout/orders/${encodeURIComponent(id)}`, orderSchema),

    /** After the buyer approved: creates the authorisation (the hold). */
    async authorizeOrder(id: string) {
      const order = await call("POST", `/v2/checkout/orders/${encodeURIComponent(id)}/authorize`, orderSchema, {
        requestId: `authorize-${id}`,
        body: {},
      });
      const auth = order.purchase_units?.[0]?.payments?.authorizations?.[0];
      return { status: order.status, authorizationId: auth?.id ?? null, authorizationStatus: auth?.status ?? null };
    },

    getAuthorization: (id: string) =>
      call("GET", `/v2/payments/authorizations/${encodeURIComponent(id)}`, paymentSchema),

    captureAuthorization: (id: string) =>
      call("POST", `/v2/payments/authorizations/${encodeURIComponent(id)}/capture`, paymentSchema, {
        requestId: `capture-${id}`,
        body: { final_capture: true },
      }),

    async voidAuthorization(id: string) {
      await call("POST", `/v2/payments/authorizations/${encodeURIComponent(id)}/void`, null, {
        requestId: `void-${id}`,
      });
    },

    getCapture: (id: string) => call("GET", `/v2/payments/captures/${encodeURIComponent(id)}`, paymentSchema),

    /** A payout batch. The sender batch id is the idempotency key (PayPal also dedupes on it). */
    async createPayout(senderBatchId: string, subject: string, items: PayoutItemInput[]) {
      const out = await call(
        "POST",
        "/v1/payments/payouts",
        z.object({ batch_header: z.object({ payout_batch_id: z.string(), batch_status: z.string() }) }),
        {
          requestId: senderBatchId,
          body: {
            sender_batch_header: { sender_batch_id: senderBatchId, email_subject: subject },
            items: items.map((i) => ({
              recipient_type: "EMAIL",
              receiver: i.receiver,
              note: i.note,
              sender_item_id: i.senderItemId,
              amount: { currency: "USD", value: centsToValue(i.amountCents) },
            })),
          },
        },
      );
      return { batchId: out.batch_header.payout_batch_id, status: out.batch_header.batch_status };
    },

    getPayoutItem: (id: string) => call("GET", `/v1/payments/payouts-item/${encodeURIComponent(id)}`, payoutItemSchema),

    getPayoutBatch: (id: string) =>
      call(
        "GET",
        `/v1/payments/payouts/${encodeURIComponent(id)}`,
        z.object({ items: z.array(payoutItemSchema).default([]) }),
      ),

    /**
     * PayPal's verify-webhook-signature on the raw body (08 §2.7c). The event is passed through
     * byte for byte, so re-serialising can't break the signature check.
     */
    async verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
      if (!config.webhookId) throw new PaypalError("PAYPAL_WEBHOOK_ID is not set.", 0, "config");
      const h = (name: string) => headers.get(name) ?? "";
      if (!h("paypal-transmission-id") || !h("paypal-transmission-sig")) return false;
      const prefix = JSON.stringify({
        auth_algo: h("paypal-auth-algo"),
        cert_url: h("paypal-cert-url"),
        transmission_id: h("paypal-transmission-id"),
        transmission_sig: h("paypal-transmission-sig"),
        transmission_time: h("paypal-transmission-time"),
        webhook_id: config.webhookId,
      });
      const out = await call(
        "POST",
        "/v1/notifications/verify-webhook-signature",
        z.object({ verification_status: z.string() }),
        { rawBody: `${prefix.slice(0, -1)},"webhook_event":${rawBody}}` },
      );
      return out.verification_status === "SUCCESS";
    },
  };
}
export type Paypal = ReturnType<typeof createPaypal>;
