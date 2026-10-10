"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { getQueryClient } from "@/lib/query/client";

/** Mount in route-group layouts that fetch data ((app), (auth), (teach), (admin)), not the landing page. */
export function QueryProvider({ children }: { children: ReactNode }) {
  // Not useState: a suspending render would throw away a client created in state.
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
    </QueryClientProvider>
  );
}
