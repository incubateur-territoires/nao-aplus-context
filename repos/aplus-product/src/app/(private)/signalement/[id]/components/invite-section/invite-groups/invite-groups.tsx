"use client";

import { useGroupFiltering } from "@/app/hooks/use-group-filtering";
import { TeamSelectionContainer } from "@/app/component/team-selection-container/team-selection-container";
import { useMemo, useEffect } from "react";
import { Controller, FormProvider } from "react-hook-form";
import Button from "@codegouvfr/react-dsfr/Button";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Team } from "@/generated/prisma/browser";
import { useTRPC } from "@/trpc/client";
import { SelectedOption, SelectedOptionEnum } from "../types";
import { useInviteGroups } from "./use-invite-groups";
import { GroupCheckboxList } from "./group-checkbox-list/group-checkbox-list";
import { MessageInput } from "./message-input/message-input";

interface InviteGroupsProps {
  requestAreaId: string | undefined;
  alreadyLinkedRequestedTeamsIds: string[];
  onResetSelection: () => void;
  authorsAndCoAuthorsIds: string[];
  reportApplicantTeam: Team | undefined;
  selectedOption: SelectedOption;
  isAuthor: boolean;
}

export function InviteGroups({
  isAuthor,
  authorsAndCoAuthorsIds,
  reportApplicantTeam,
  requestAreaId,
  alreadyLinkedRequestedTeamsIds,
  onResetSelection,
  selectedOption,
}: InviteGroupsProps) {
  const { id: reportId } = useParams<{ id: string }>();
  const trpc = useTRPC();

  const { data: areas } = useQuery(trpc.area.getActiveAreas.queryOptions());

  const { formMethods, onSubmit, isSubmitting } = useInviteGroups({
    alreadyLinkedRequestedTeamsIds,
    reportId,
    authorsAndCoAuthorsIds,
    reportApplicantTeam,
    onResetSelection,
    selectedOption,
    requestAreaId,
  });

  const selectedAreaId = formMethods.watch("areaId");

  const defaultMessageAndAlert = useMemo(() => {
    if (selectedOption === SelectedOptionEnum.IS_IRRELEVANT) {
      return {
        message:
          "Bonjour,\nNotre équipe ne peut pas répondre à ce signalement.\nNous transmettons le signalement à l'équipe opérateur concernée.\nCordialement.",
        alert:
          "Si votre équipe n'est pas le bon interlocuteur pour répondre à ce signalement et que vous connaissez le ou les équipes opérateurs à contacter, merci de le signaler à l'aidant dans le formulaire ci-dessous.",
      };
    }
    if (selectedOption === SelectedOptionEnum.ORGANIZATIONS) {
      return {
        message:
          "Bonjour,\nCe signalement nécessite l'intervention d'une autre équipe opérateur.\nNous l'avons donc ajoutée au signalement.\nCordialement.",
        alert:
          "Si vous savez que ce signalement nécessite l'intervention d'une ou plusieurs équipes opérateurs qui ne figurent pas dans le signalement initial, merci de le signaler à l'aidant dans le formulaire ci-dessous.",
      };
    }
    return { message: "", alert: "" };
  }, [selectedOption]);

  useEffect(() => {
    if (requestAreaId && !selectedAreaId) {
      formMethods.setValue("areaId", requestAreaId);
    }
  }, [requestAreaId, selectedAreaId, formMethods]);

  useEffect(() => {
    if (defaultMessageAndAlert.message) {
      formMethods.setValue("message", defaultMessageAndAlert.message);
    }
  }, [defaultMessageAndAlert.message, formMethods]);

  const {
    isLoadingNotInvitedTeams,
    filteredNotInvitedTeams,
    tags,
    selectedFilters,
    setSelectedFilters,
  } = useGroupFiltering(
    {
      areaIds: selectedAreaId ? [selectedAreaId] : [],
      applicantTeamId: reportApplicantTeam?.id,
    },
    alreadyLinkedRequestedTeamsIds,
  );

  const hasNoTeams =
    !isLoadingNotInvitedTeams &&
    filteredNotInvitedTeams &&
    filteredNotInvitedTeams.length === 0;

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={onSubmit(filteredNotInvitedTeams)}>
        <Controller
          control={formMethods.control}
          name="areaId"
          render={({ field }) => (
            <div className="flex flex-col gap-1 w-full sm:w-1/2">
              <Select
                label="Territoire concerné"
                className="w-full"
                nativeSelectProps={{
                  value: field.value ?? "",
                  onChange: (e) => {
                    field.onChange(e.target.value);
                    formMethods.setValue("teamIds", []);
                    setSelectedFilters([]);
                  },
                }}
              >
                <option value="" disabled>
                  Sélectionnez un territoire
                </option>
                {areas?.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        />
        {selectedAreaId && hasNoTeams && (
          <p className="text-center mt-6">Aucun organisme trouvé</p>
        )}
        {selectedAreaId && !hasNoTeams && (
          <TeamSelectionContainer
            tags={tags}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            isLoading={isLoadingNotInvitedTeams}
          >
            <GroupCheckboxList
              filteredNotInvitedTeams={filteredNotInvitedTeams}
            />
          </TeamSelectionContainer>
        )}
        {isAuthor ? null : (
          // Encart informatif statique : pas de role="alert" (le composant DSFR
          // Alert force un role assertif inadapté à un contenu permanent, RGAA 7.1).
          <div className="fr-alert fr-alert--warning fr-alert--sm mt-10 mb-2">
            <p>{defaultMessageAndAlert.alert}</p>
          </div>
        )}
        <MessageInput isRequired={true} />
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="large">
            Inviter d&apos;autres équipes opérateur
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
