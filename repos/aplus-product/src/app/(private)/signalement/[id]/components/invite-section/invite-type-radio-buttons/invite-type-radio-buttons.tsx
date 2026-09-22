"use client";

import { useEffect, useState } from "react";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import { SelectedOptionEnum } from "../types";

interface InviteOption {
  label: string;
  hintText: string;
  value: SelectedOptionEnum;
}

interface InviteTypeRadioButtonsProps {
  showColleaguesToInvite?: boolean;
  effectiveSelectedOption: SelectedOptionEnum | null;
  selectedOption?: SelectedOptionEnum | null;
  onOptionChange: (option: SelectedOptionEnum) => void;
  requestedTeamName?: string | null;
}

const OPTIONS_HELPER: InviteOption[] = [
  {
    label: "Inviter des membres de l'équipe à devenir co-auteurs",
    hintText: "Le signalement conservera son statut actuel",
    value: SelectedOptionEnum.COLLEAGUES,
  },
  {
    label: "Ce signalement nécessite l’intervention d’autres équipes opérateur",
    hintText: "Le signalement conservera son statut actuel",
    value: SelectedOptionEnum.ORGANIZATIONS,
  },
];

function getInstructorOptions(
  requestedTeamName?: string | null,
): InviteOption[] {
  return [
    {
      label: requestedTeamName
        ? `${requestedTeamName} n'est pas le bon interlocuteur`
        : "Cette équipe n'est pas le bon interlocuteur",
      hintText: "Le signalement conservera son statut actuel",
      value: SelectedOptionEnum.IS_IRRELEVANT,
    },
    {
      label:
        "Ce signalement nécessite l'intervention d'autres équipes opérateur",
      hintText: "Le signalement conservera son statut actuel",
      value: SelectedOptionEnum.ORGANIZATIONS,
    },
  ];
}
export function InviteTypeRadioButtonsAuthor({
  showColleaguesToInvite,
  effectiveSelectedOption,
  selectedOption,
  onOptionChange,
}: InviteTypeRadioButtonsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSR and initial render, use safe defaults to avoid hydration mismatch
  const safeShowColleaguesToInvite = isMounted ? showColleaguesToInvite : false;
  const safeHasDisabledRadios = !safeShowColleaguesToInvite;
  const safeShouldCheckRadios =
    safeHasDisabledRadios || selectedOption !== null;

  return (
    <RadioButtons
      options={OPTIONS_HELPER.map((option) => ({
        label: option.label,
        hintText: (
          <p className="text-xs m-0 font-regular text-[#666666]">
            {!safeShowColleaguesToInvite &&
            option.value === SelectedOptionEnum.COLLEAGUES
              ? "Il n'y a pas d'autre membre de l'équipe à inviter"
              : option.hintText}
          </p>
        ),

        nativeInputProps: {
          disabled:
            !safeShowColleaguesToInvite &&
            option.value === SelectedOptionEnum.COLLEAGUES,
          name: "inviteType",
          value: option.value,
          checked:
            safeShouldCheckRadios && effectiveSelectedOption === option.value,
          onChange: () => onOptionChange(option.value),
        },
      }))}
    />
  );
}

export function InviteTypeRadioButtonsRecipient({
  effectiveSelectedOption,
  onOptionChange,
  requestedTeamName,
}: InviteTypeRadioButtonsProps) {
  const options = getInstructorOptions(requestedTeamName);

  return (
    <RadioButtons
      legend="Motif de l'invitation :"
      id="invite-type-recipient"
      // Le DSFR référence par défaut le groupe de messages dans aria-labelledby
      // (donc dans le *nom* du groupe). On limite le nom à la légende et on
      // expose un éventuel message comme *description* via aria-describedby (a11y).
      aria-labelledby="invite-type-recipient-legend"
      aria-describedby="invite-type-recipient-messages"
      options={options.map((option) => ({
        label: option.label,
        hintText: (
          <p className="text-xs m-0 font-regular text-[#666666]">
            {option.hintText}
          </p>
        ),
        nativeInputProps: {
          name: "inviteType",
          value: option.value,
          checked: effectiveSelectedOption === option.value,
          onChange: () => onOptionChange(option.value),
        },
      }))}
    />
  );
}
