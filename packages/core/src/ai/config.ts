import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import { CONFIG_SCHEMAS, type ConfigKey, type ConfigReader, type ConfigValue } from "./config-schema";

// Runtime config from app_config (02 §9): model routes, prices, quotas, caps, kill switches.
// Every value is validated; values are cached per instance for 60 s, so an admin edit applies
// within a minute (P0-13). Shared by Next (lib/config.ts) and the worker.

const TTL_MS = 60_000;

export function createConfigReader(db: SupabaseClient<Database>): ConfigReader & { clear: () => void } {
  const cache = new Map<ConfigKey, { value: unknown; expires: number }>();

  const read = async <K extends ConfigKey>(key: K): Promise<ConfigValue<K>> => {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as ConfigValue<K>;

    const { data, error } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
    if (error) throw new Error(`Couldn't read app_config.${key}: ${error.message}`);
    if (!data) throw new Error(`app_config.${key} is missing. Run the migrations (supabase db push).`);

    const parsed = CONFIG_SCHEMAS[key].safeParse(data.value);
    if (!parsed.success) {
      throw new Error(`app_config.${key} is invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    cache.set(key, { value: parsed.data, expires: Date.now() + TTL_MS });
    return parsed.data as ConfigValue<K>;
  };

  return Object.assign(read, { clear: () => cache.clear() });
}
