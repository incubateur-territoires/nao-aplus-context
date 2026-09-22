import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const handler = (req: Request) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError: (opts) => {
      if (opts.error.code === "INTERNAL_SERVER_ERROR") {
        // send to bug reporting
        console.error("Something went wrong", opts.error);
      }
    },
  });
};
export { handler as GET, handler as POST };
