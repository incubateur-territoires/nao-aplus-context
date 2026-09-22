// Re-export server utilities
// This file is kept for backward compatibility but the actual implementation
// is in server-utils.ts which has "server-only" import
export { trpc, prefetch } from "./server-utils";
