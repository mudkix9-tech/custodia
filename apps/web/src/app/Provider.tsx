"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchStreamLink } from "@trpc/client";
import React, { useState } from "react";
import { trpc } from "../utils/trpc";
import { SessionProvider } from "next-auth/react";

export default function Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Was the library default of 0, so every remount refetched even with
            // the answer already cached — settings.getUserSettings alone is read
            // by the notifications, security and profile tabs. 30s matches the
            // router cache staleTime in next.config.ts so the two layers expire
            // together rather than one re-showing a skeleton the other avoided.
            // Left refetchOnWindowFocus on: with a staleTime it only fires on
            // genuinely stale data, and coming back to a tab is exactly when a
            // change made elsewhere should appear.
            staleTime: 30 * 1000,
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        // Streaming variant of the batch link: procedures that return an async
        // generator (the Copilot) arrive incrementally instead of buffering.
        // Everything else behaves exactly as it did under httpBatchLink.
        httpBatchStreamLink({
          url: typeof window !== "undefined"
            ? "/api/trpc"
            : `${process.env.API_URL || "http://localhost:4000"}/api/trpc`,
          // You can pass any headers here if needed
        }),
      ],
    })
  );

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
