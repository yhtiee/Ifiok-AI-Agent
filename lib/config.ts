import "server-only";
import { createConfigReader } from "@ifiok/core/ai/config";
import type { ConfigKey, ConfigValue } from "@ifiok/core/ai/config-schema";
import { createAdminClient } from "@/lib/supabase/admin";

// Runtime config from app_config (02 §9), cached per server instance for 60 s (shared reader in
// packages/core, so the worker validates config the same way).

let reader: ReturnType<typeof createConfigReader> | null = null;

export async function getConfig<K extends ConfigKey>(key: K): Promise<ConfigValue<K>> {
  reader ??= createConfigReader(createAdminClient());
  return reader(key);
}

/** For tests and admin writes: drop cached values so the next read hits the database. */
export function clearConfigCache() {
  reader?.clear();
}
