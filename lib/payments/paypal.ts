import "server-only";
import { createPaypal, type Paypal } from "@ifiok/core/payments/paypal";
import { RouteError } from "@/lib/api/route";
import { serverEnv } from "@/lib/env/server";

// The PayPal sandbox client for the Next server (10 MVP-07). Server only: the client id and secret
// never reach the browser (guardrail 1's pattern for keys).

let client: Paypal | null = null;

export function paypalReady(): boolean {
  return Boolean(serverEnv.PAYPAL_CLIENT_ID && serverEnv.PAYPAL_CLIENT_SECRET && serverEnv.PAYPAL_ENV === "sandbox");
}

export function getPaypal(): Paypal {
  if (!paypalReady())
    throw new RouteError(503, "PayPal (sandbox) isn't connected yet. Try again once it's set up.", "paypal_off");
  client ??= createPaypal({
    clientId: serverEnv.PAYPAL_CLIENT_ID!,
    clientSecret: serverEnv.PAYPAL_CLIENT_SECRET!,
    env: serverEnv.PAYPAL_ENV,
    webhookId: serverEnv.PAYPAL_WEBHOOK_ID,
  });
  return client;
}
