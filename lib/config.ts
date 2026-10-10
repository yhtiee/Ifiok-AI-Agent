import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONFIG_SCHEMAS, type ConfigKey, type ConfigValue } from "./config-schema";

// Runtime config from app_config (02 §9): model routes, prices, quotas, caps, kill switches.
// Cached per server instance for 60 s, so an admin edit applies within a minute (P0-13).

const TTL_MS = 60_000;
const cache = new Map<ConfigKey, { value: unknown; expires: number }>();

export async function getConfig<K extends ConfigKey>(key: K): Promise<ConfigValue<K>> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as ConfigValue<K>;

  const { data, error } = await createAdminClient().from("app_config").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`Couldn't read app_config.${key}: ${error.message}`);
  if (!data) throw new Error(`app_config.${key} is missing. Run the migrations (supabase db push).`);

  const parsed = CONFIG_SCHEMAS[key].safeParse(data.value);
  if (!parsed.success) {
    throw new Error(`app_config.${key} is invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  cache.set(key, { value: parsed.data, expires: Date.now() + TTL_MS });
  return parsed.data as ConfigValue<K>;
}

/** For tests and admin writes: drop cached values so the next read hits the database. */
export function clearConfigCache() {
  cache.clear();
}
