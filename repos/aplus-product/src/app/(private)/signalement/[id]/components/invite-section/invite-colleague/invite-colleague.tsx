"use client";

import { useParams } from "next/navigation";
import { FormProvider } from "react-hook-form";
import Button from "@codegouvfr/react-dsfr/Button";
import { Team } from "@/generated/prisma/browser";
import { useInviteCoAuthors } from "./use-invite-co-authors";
import { ColleagueCheckboxList } from "./colleague-checkbox-list/colleague-checkbox-list";
import { OptionalMessageInput } from "./optional-message-input/optional-message-input";

interface ColleagueSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface InviteColleagueProps {
  colleaguesToInvite: ColleagueSummary[];
  onResetSelection: () => void;
  reportAuthor: { id: string; firstName: string; lastName: string } | undefined;
  reportApplicantTeam: Team | undefined;
}

export function InviteColleague({
  colleaguesToInvite,
  onResetSelection,
  reportAuthor,
  reportApplicantTeam,
}: InviteColleagueProps) {
  const { id } = useParams<{ id: string }>();

  const { formMethods, onSubmit, isSubmitting } = useInviteCoAuthors({
    reportId: id,
    colleaguesToInvite,
    reportAuthor,
    reportApplicantTeam,
    onResetSelection,
  });

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={onSubmit}>
        <ColleagueCheckboxList colleagues={colleaguesToInvite} />
        <OptionalMessageInput showHintText={false} />
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="large">
            Inviter des membres de l&apos;équipe
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
