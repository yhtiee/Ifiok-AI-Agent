import "server-only";
import { cache } from "react";
import { makeQueryClient } from "./client";

/**
 * Per-request QueryClient for server components. Prefetch with it, then pass
 * `dehydrate(getServerQueryClient())` to a `<HydrationBoundary>` around the client components.
 */
export const getServerQueryClient = cache(makeQueryClient);
