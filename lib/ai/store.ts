import "server-only";
import { createSupabaseGatewayStore as createStore } from "@ifiok/core/ai/store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GatewayStore } from "./gateway";

// The gateway's database side for Next, through the service role (shared code in packages/core).
export function createSupabaseGatewayStore(): GatewayStore {
  return createStore(createAdminClient());
}
