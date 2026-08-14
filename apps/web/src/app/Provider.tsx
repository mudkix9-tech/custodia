"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchStreamLink } from "@trpc/client";
import React, { useState } from "react";
import { trpc } from "../utils/trpc";
import { SessionProvider } from "next-auth/react";

export default function Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
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
