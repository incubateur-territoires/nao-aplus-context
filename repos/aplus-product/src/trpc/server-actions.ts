"use server";

import { getServerTRPCCaller } from "./server-utils";

// Server action to prefetch data
export async function prefetchReports() {
  const caller = await getServerTRPCCaller();
  return await caller.report.getMyCreatedReportsTable();
}

export async function prefetchCurrentUser() {
  const caller = await getServerTRPCCaller();
  return await caller.user.getCurrentUser();
}
