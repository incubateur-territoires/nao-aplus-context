import "server-only";
import {
  createTRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";
import { createCallerFactory, createTRPCContext } from "./init";
import { appRouter } from "./routers/_app";
import { getQueryClient } from "./hydrate-client";

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

const createCaller = createCallerFactory(appRouter);

/**
 * Server-only tRPC caller, intended for Server Components and Server Actions.
 * Lives in this `"server-only"` (not `"use server"`) module so it isn't
 * exposed as a Server Action endpoint — Server Actions can't serialize the
 * caller proxy across the network anyway, and exposing one is just dead
 * surface area.
 */
export async function getServerTRPCCaller() {
  const ctx = await createTRPCContext();
  return createCaller(ctx);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
): Promise<void> {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    return queryClient.prefetchQuery(queryOptions);
  }
}
