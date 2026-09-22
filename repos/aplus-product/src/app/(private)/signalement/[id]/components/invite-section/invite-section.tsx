"use client";

import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";
import { RecipientInviteSection } from "./invite-section-recipient/invite-section-recipient";
import { AuthorInviteSection } from "./invite-section-author/invite-section-author";

export { SelectedOptionEnum } from "./types";

export function InviteSection({
  initialReport,
  isAuthor,
}: {
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
  isAuthor: boolean;
}) {
  return (
    <>
      {isAuthor ? (
        <AuthorInviteSection initialReport={initialReport} />
      ) : (
        <RecipientInviteSection initialReport={initialReport} />
      )}
    </>
  );
}
