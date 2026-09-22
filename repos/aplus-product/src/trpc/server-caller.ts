import "server-only";
import { createCallerFactory } from "./init";
import { appRouter } from "./routers/_app";
import { createTRPCContext } from "./init";

export const serverClient = createCallerFactory(appRouter)(async () => {
  return await createTRPCContext();
});
