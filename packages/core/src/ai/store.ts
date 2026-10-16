import type { SupabaseClient } from "@supabase/supabase-js";
import { CONSENT_VERSION, REQUIRED_CONSENTS } from "../consent";
import type { Database } from "../db/types";
import type { GatewayStore } from "./gateway";

// The gateway's database side, through the service role: these tables and functions are
// server-only by design (03 §5, 03 §8). Shared by Next (lib/ai/store.ts) and the worker.
export function createSupabaseGatewayStore(db: SupabaseClient<Database>): GatewayStore {
  return {
    async loadUserPolicy(userId) {
      const [{ data: profile, error }, { data: consents }] = await Promise.all([
        db.from("profiles").select("status, is_adult").eq("id", userId).maybeSingle(),
        db.from("consents").select("kind").eq("user_id", userId).eq("version", CONSENT_VERSION).is("revoked_at", null),
      ]);
      if (error) throw new Error("Couldn't load the user's profile");
      if (!profile) return null;
      const kinds = new Set((consents ?? []).map((c) => c.kind));
      return {
        active: profile.status === "active",
        adult: profile.is_adult,
        consented: REQUIRED_CONSENTS.every((k) => kinds.has(k)),
      };
    },
    async consumeQuota(userId, feature, limit) {
      const { data, error } = await db.rpc("consume_quota", { p_user: userId, p_feature: feature, p_limit: limit });
      if (error) throw new Error("Couldn't reserve the allowance");
      return data === true;
    },
    async refundQuota(userId, feature) {
      const { error } = await db.rpc("refund_quota", { p_user: userId, p_feature: feature });
      if (error) throw new Error("Couldn't refund the allowance");
    },
    async spendSince(since, filter) {
      const { data, error } = await db.rpc("ai_spend_micros", {
        p_since: since.toISOString(),
        p_user: filter.userId,
        p_features: filter.features ? [...filter.features] : undefined,
      });
      if (error) throw new Error("Couldn't read AI spend");
      return Number(data ?? 0);
    },
    async recordCall(row) {
      const { error } = await db.from("ai_calls").insert(row);
      if (error) throw new Error("Couldn't record the AI call");
    },
  };
}
