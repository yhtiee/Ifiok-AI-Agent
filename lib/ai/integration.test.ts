import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/types";

// Integration checks against the real Supabase project and Gemini (pnpm test:integration).
// Not part of pnpm check: they need keys, the network, and cost a fraction of a cent.
// Synthetic text only (04 §3: no real user content outside the paid tier).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

let userId = "";

beforeAll(async () => {
  const { data, error } = await db.auth.admin.createUser({
    email: `e2e-ai-${randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (error || !data.user) throw error;
  userId = data.user.id;
  await db.from("profiles").update({ is_adult: true, birth_year: 1999, birth_month: 4 }).eq("id", userId);
  const { CONSENT_VERSION } = await import("@/lib/auth/consent");
  await db
    .from("consents")
    .insert(["terms", "privacy", "ai_disclosure"].map((kind) => ({ user_id: userId, kind, version: CONSENT_VERSION })));
});

afterAll(async () => {
  if (userId) await db.auth.admin.deleteUser(userId);
});

describe("consume_quota under real concurrency", () => {
  it("20 parallel reservations against a limit of 5 grant exactly 5", async () => {
    const feature = `race_${Date.now()}`;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => db.rpc("consume_quota", { p_user: userId, p_feature: feature, p_limit: 5 })),
    );
    expect(results.every((r) => !r.error)).toBe(true);
    expect(results.filter((r) => r.data === true)).toHaveLength(5);

    await db.rpc("refund_quota", { p_user: userId, p_feature: feature });
    const again = await db.rpc("consume_quota", { p_user: userId, p_feature: feature, p_limit: 5 });
    expect(again.data).toBe(true); // a refund frees exactly one slot
  });
});

describe("live gateway (Gemini)", () => {
  it("moderates synthetic text end to end and records the call with its cost", async () => {
    const { getGateway } = await import("./index");
    const gateway = getGateway();
    const since = new Date().toISOString();

    const fine = await gateway.run<{ allowed: boolean; categories: string[] }>("moderate", {
      userId,
      input: { text: "MTH 101 Elementary Mathematics I", context: "course_name" },
    });
    expect(fine.output.allowed).toBe(true);

    const spam = await gateway.run<{ allowed: boolean; categories: string[] }>("moderate", {
      userId,
      input: { text: "Buy cheap followers now, call 0801 234 5678", context: "course_name" },
    });
    expect(spam.output.allowed).toBe(false);
    expect(spam.output.categories.some((c) => c === "spam" || c === "personal_data")).toBe(true);

    const { data: rows } = await db
      .from("ai_calls")
      .select(
        "feature, provider, model, input_tokens, output_tokens, thinking_tokens, cost_micros, list_cost_micros, ok, prompt_version",
      )
      .eq("user_id", userId)
      .gte("created_at", since);
    expect(rows!.length).toBeGreaterThanOrEqual(2);
    // The model comes from app_config.ai_routes (model IDs never live in code).
    const { data: routes } = await db.from("app_config").select("value").eq("key", "ai_routes").single();
    const moderate = (routes!.value as { moderate: { provider: string; model: string } }).moderate;
    for (const row of rows!) {
      expect(row).toMatchObject({
        feature: "moderate",
        provider: moderate.provider,
        model: moderate.model,
        ok: true,
        prompt_version: 2,
      });
      expect(row.input_tokens).toBeGreaterThan(0);
      expect(row.list_cost_micros).toBeGreaterThan(0); // paid-tier equivalent, for the pilot's cost metric
      expect(row.cost_micros).toBe(0); // free tier (12 §4 Q25)
    }
    console.log(
      "live moderate calls:",
      rows!.map(
        (r) =>
          `${r.input_tokens} in / ${r.output_tokens} out / ${r.thinking_tokens} thinking = ${r.list_cost_micros} µ$ at list price, ${r.cost_micros} actual`,
      ),
    );
  }, 60_000);

  it("refuses a user who hasn't agreed to the terms", async () => {
    const { getGateway, GatewayError } = await import("./index");
    await db.from("consents").delete().eq("user_id", userId);
    const err = await getGateway()
      .run("moderate", { userId, input: { text: "PHY 101", context: "course_name" } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GatewayError);
    expect((err as InstanceType<typeof GatewayError>).code).toBe("not_allowed");
  });
});
