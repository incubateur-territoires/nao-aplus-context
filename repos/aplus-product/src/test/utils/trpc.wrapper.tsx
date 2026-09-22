import { TRPCProvider } from "@/trpc/client";
import { AppRouter } from "@/trpc/routers/_app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
const queryClient = new QueryClient();
const trpcUrl =
  `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc` ||
  "http://localhost:3000/api/trpc";
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
    }),
  ],
});

export function TRPCWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
