"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useSyncExternalStore, type ReactNode } from "react";
import { getQueryClient } from "@/lib/query/client";

const noSubscribe = () => () => {};

/** Mount in route-group layouts that fetch data ((app), (auth), (teach), (admin)), not the landing page. */
export function QueryProvider({ children }: { children: ReactNode }) {
  // Not useState: a suspending render would throw away a client created in state.
  const queryClient = getQueryClient();
  // The devtools button sits over header actions; leave it out of automated browsers (e2e).
  const automated = useSyncExternalStore(
    noSubscribe,
    () => navigator.webdriver,
    () => true,
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {automated ? null : <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />}
    </QueryClientProvider>
  );
}
