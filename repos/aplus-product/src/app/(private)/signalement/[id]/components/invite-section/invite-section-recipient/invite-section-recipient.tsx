"use client";

import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";
import { InviteSectionHeader } from "../invite-section-header/invite-section-header";
import { InviteTypeRadioButtonsRecipient } from "../invite-type-radio-buttons/invite-type-radio-buttons";
import { InviteGroups } from "../invite-groups/invite-groups";
import { SelectedOptionEnum } from "../types";
import { useInviteSectionRecipient } from "../use-invite-section-recipient";

interface RecipientInviteSectionProps {
  initialReport: inferRouterOutputs<AppRouter>["report"]["getReportById"];
}

export function RecipientInviteSection({
  initialReport,
}: RecipientInviteSectionProps) {
  const {
    report,
    isClosed,
    mergedAlreadyLinkedRequestedTeamsIds,
    selectedOption,
    setSelectedOption,
    instructorRequestedTeam,
  } = useInviteSectionRecipient({ initialReport });

  if (isClosed) {
    return null;
  }

  return (
    <div className="bg-white p-20 flex flex-col gap-6 mt-10">
      <InviteSectionHeader showColleaguesToInvite={false} />
      <div className="flex flex-col gap-6">
        <InviteTypeRadioButtonsRecipient
          effectiveSelectedOption={selectedOption}
          onOptionChange={setSelectedOption}
          requestedTeamName={instructorRequestedTeam}
        />
      </div>
      {(selectedOption === SelectedOptionEnum.IS_IRRELEVANT ||
        selectedOption === SelectedOptionEnum.ORGANIZATIONS) && (
        <InviteGroups
          isAuthor={false}
          authorsAndCoAuthorsIds={[]}
          reportApplicantTeam={report?.applicantTeam}
          requestAreaId={report?.areaId}
          alreadyLinkedRequestedTeamsIds={mergedAlreadyLinkedRequestedTeamsIds}
          onResetSelection={() => setSelectedOption(null)}
          selectedOption={selectedOption}
        />
      )}
    </div>
  );
}
