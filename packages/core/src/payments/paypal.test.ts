import { describe, expect, it, vi } from "vitest";
import { centsToValue, createPaypal, PaypalError } from "./paypal";
import { autoReleaseAt, tutorShareCents } from "./tutoring";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Record<string, unknown>) {
  const calls: Call[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init: init ?? {} });
    if (u.endsWith("/v1/oauth2/token")) return Response.json({ access_token: "tok", expires_in: 3600 });
    const key = Object.keys(responses).find((k) => u.includes(k));
    if (!key) return new Response("{}", { status: 404 });
    return Response.json(responses[key]);
  });
  return { f: f as unknown as typeof fetch, calls };
}

const make = (responses: Record<string, unknown>) => {
  const { f, calls } = fakeFetch(responses);
  return {
    paypal: createPaypal({ clientId: "id", clientSecret: "secret", env: "sandbox", webhookId: "WH", fetch: f }),
    calls,
  };
};

describe("PayPal sandbox client (MVP-07, 08 §2.7c)", () => {
  it("refuses to run outside the sandbox", () => {
    expect(() => createPaypal({ clientId: "a", clientSecret: "b", env: "live" })).toThrow(PaypalError);
    expect(() => createPaypal({ clientId: "a", clientSecret: "b", env: undefined })).toThrow(PaypalError);
  });

  it("creates an AUTHORIZE order with the booking as custom id and an idempotent request id", async () => {
    const { paypal, calls } = make({
      "/v2/checkout/orders": {
        id: "ORDER-1",
        status: "PAYER_ACTION_REQUIRED",
        links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1" }],
      },
    });
    const out = await paypal.createAuthorizeOrder({
      amountCents: 1250,
      description: "Ifiok tutoring",
      customId: "b-1",
      returnUrl: "https://x/ok",
      cancelUrl: "https://x/no",
    });
    expect(out).toEqual({ orderId: "ORDER-1", approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1" });
    const call = calls.find((c) => c.url.endsWith("/v2/checkout/orders"))!;
    const body = JSON.parse(String(call.init.body));
    expect(body.intent).toBe("AUTHORIZE");
    expect(body.purchase_units[0]).toMatchObject({
      custom_id: "b-1",
      amount: { currency_code: "USD", value: "12.50" },
    });
    expect((call.init.headers as Record<string, string>)["paypal-request-id"]).toBe("order-b-1");
    expect(call.url.startsWith("https://api-m.sandbox.paypal.com")).toBe(true);
  });

  it("gets one token and reuses it", async () => {
    const { paypal, calls } = make({ "/v2/payments/authorizations/A/capture": { id: "CAP", status: "COMPLETED" } });
    await paypal.captureAuthorization("A");
    await paypal.captureAuthorization("A");
    expect(calls.filter((c) => c.url.endsWith("/oauth2/token"))).toHaveLength(1);
    const capture = calls.filter((c) => c.url.includes("/capture"));
    expect((capture[1]!.init.headers as Record<string, string>)["paypal-request-id"]).toBe("capture-A");
  });

  it("verifies a webhook with the raw event body passed through untouched", async () => {
    const { paypal, calls } = make({
      "/v1/notifications/verify-webhook-signature": { verification_status: "SUCCESS" },
    });
    const raw = '{"id":"WH-1","event_type":"PAYMENT.PAYOUTS-ITEM.SUCCEEDED", "resource":{"amount":{"value":"1.10"}}}';
    const headers = new Headers({
      "paypal-transmission-id": "t",
      "paypal-transmission-sig": "s",
      "paypal-transmission-time": "now",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
    });
    expect(await paypal.verifyWebhook(headers, raw)).toBe(true);
    const body = String(calls.find((c) => c.url.includes("verify-webhook"))!.init.body);
    expect(body.endsWith(`"webhook_event":${raw}}`)).toBe(true);
    expect(JSON.parse(body)).toMatchObject({ webhook_id: "WH", transmission_id: "t" });
    // No PayPal headers: not from PayPal, and nothing is sent to check it.
    expect(await paypal.verifyWebhook(new Headers(), raw)).toBe(false);
  });

  it("retries a network failure, keeping the same request id so PayPal can't act twice", async () => {
    const { f, calls } = fakeFetch({ "/v2/payments/authorizations/A/capture": { id: "CAP", status: "COMPLETED" } });
    let failures = 1;
    const flaky = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/capture") && failures-- > 0) throw new TypeError("fetch failed");
      return f(url, init);
    }) as typeof fetch;
    const paypal = createPaypal({ clientId: "id", clientSecret: "secret", env: "sandbox", fetch: flaky });
    expect(await paypal.captureAuthorization("A")).toEqual({ id: "CAP", status: "COMPLETED" });
    const captures = calls.filter((c) => c.url.includes("/capture"));
    expect(captures).toHaveLength(1);
    expect((captures[0]!.init.headers as Record<string, string>)["paypal-request-id"]).toBe("capture-A");
  });

  it("formats cents and splits the tutor's share", () => {
    expect(centsToValue(5)).toBe("0.05");
    expect(tutorShareCents(1000, 1500)).toBe(850);
    expect(tutorShareCents(333, 1500)).toBe(283);
    const at = autoReleaseAt({ starts_at: "2026-11-01T17:00:00Z", minutes: 45 }, 24);
    expect(at.toISOString()).toBe("2026-11-02T17:45:00.000Z");
  });
});
