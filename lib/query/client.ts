import {
  MutationCache,
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
  type QueryKey,
} from "@tanstack/react-query";
import { ApiError } from "./api";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * Query keys (or key prefixes from `queryKeys`) to invalidate when the mutation settles.
       * Declare them here instead of writing onSuccess handlers, so invalidation stays uniform.
       */
      invalidates?: readonly QueryKey[];
    };
  }
}

const MAX_RETRIES = 2;

export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && !error.retryable) return false;
  return failureCount < MAX_RETRIES;
}

export function makeQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      // Invalidate after success or failure: a failed optimistic update must refetch the truth.
      onSettled: async (_data, _error, _variables, _context, mutation) => {
        const keys = mutation.meta?.invalidates;
        if (!keys?.length) return;
        await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      },
    }),
    defaultOptions: {
      queries: {
        // With SSR, a short stale time stops the client refetching what the server just sent.
        staleTime: 60_000,
        retry: shouldRetry,
        // Data-light by default (00 §4): no refetch every time the student switches apps.
        refetchOnWindowFocus: false,
        // Serve cached data offline; refetch when the connection returns.
        networkMode: "offlineFirst",
      },
      mutations: {
        retry: false,
      },
      dehydrate: {
        // Also send pending queries, so server prefetches can stream into client components.
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
  return queryClient;
}

let browserQueryClient: QueryClient | undefined;

/** One client per browser tab; a fresh one per server render. */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
