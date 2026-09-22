"use client";

import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";
import { LoadingState } from "../loading-state/loading-state";
import { InviteSectionHeader } from "../invite-section-header/invite-section-header";
import { InviteTypeRadioButtonsAuthor } from "../invite-type-radio-buttons/invite-type-radio-buttons";
import { InviteColleague } from "../invite-colleague/invite-colleague";
import { InviteGroups } from "../invite-groups/invite-groups";
import { SelectedOptionEnum } from "../types";
import { useInviteSectionAuthor } from "../use-invite-section-author";
import { useMemo } from "react";

interface AuthorInviteSectionProps {
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
}

export function AuthorInviteSection({
  initialReport,
}: AuthorInviteSectionProps) {
  const {
    report,
    isLoading,
    isClosed,
    colleaguesToInvite,
    showColleaguesToInvite,
    effectiveSelectedOption,
    selectedOption,
    mergedAlreadyLinkedRequestedTeamsIds,
    setSelectedOption,
  } = useInviteSectionAuthor({ initialReport });

  const isCompleted = report?.status === "COMPLETED";

  const authorsAndCoAuthorsIds = useMemo(() => {
    return [
      report?.authorId,
      ...(report?.coAuthors?.map((coAuthor) => coAuthor.id) ?? []),
    ].filter((id): id is string => id !== undefined);
  }, [report?.authorId, report?.coAuthors]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (isClosed || isCompleted) {
    return null;
  }
  return (
    <div className="bg-white p-20 flex flex-col gap-6 mt-10">
      <InviteSectionHeader showColleaguesToInvite={showColleaguesToInvite} />
      <div className="flex flex-col gap-6">
        <InviteTypeRadioButtonsAuthor
          showColleaguesToInvite={showColleaguesToInvite}
          effectiveSelectedOption={effectiveSelectedOption}
          selectedOption={selectedOption}
          onOptionChange={(option) => setSelectedOption(option)}
        />
      </div>
      {selectedOption === SelectedOptionEnum.COLLEAGUES && (
        <InviteColleague
          colleaguesToInvite={colleaguesToInvite}
          onResetSelection={() => setSelectedOption(null)}
          reportAuthor={report?.author}
          reportApplicantTeam={report?.applicantTeam}
        />
      )}
      {selectedOption === SelectedOptionEnum.ORGANIZATIONS && (
        <InviteGroups
          isAuthor={true}
          authorsAndCoAuthorsIds={authorsAndCoAuthorsIds ?? []}
          reportApplicantTeam={report?.applicantTeam}
          requestAreaId={report?.areaId}
          alreadyLinkedRequestedTeamsIds={mergedAlreadyLinkedRequestedTeamsIds}
          onResetSelection={() => setSelectedOption(null)}
          selectedOption={effectiveSelectedOption}
        />
      )}
    </div>
  );
}
