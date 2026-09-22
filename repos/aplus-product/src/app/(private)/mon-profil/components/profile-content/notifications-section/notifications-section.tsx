"use client";

import { Controller, useFormContext } from "react-hook-form";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { NotificationFrequency } from "@/generated/prisma/enums";
import {
  ProfileFormValues,
  NOTIFICATION_FREQUENCY_OPTIONS,
} from "../profile-schema";

export function NotificationsSection() {
  const formMethods = useFormContext<ProfileFormValues>();
  const trpc = useTRPC();

  const { data: isManager, isLoading: isManagerLoading } = useQuery(
    trpc.user.isManager.queryOptions(),
  );

  const { data: isSupervisor, isLoading: isSupervisorLoading } = useQuery(
    trpc.user.isSupervisor.queryOptions(),
  );

  const canShowNone =
    (isManager === true || isSupervisor === true) &&
    !isManagerLoading &&
    !isSupervisorLoading;

  const { data: canDisableNotifications } = useQuery({
    ...trpc.user.canDisableNotifications.queryOptions(),
    enabled: canShowNone,
  });

  // Filter out NONE option for non-managers/non-supervisors
  const availableOptions = NOTIFICATION_FREQUENCY_OPTIONS.filter((option) => {
    if (option.value === NotificationFrequency.NONE) {
      return canShowNone;
    }
    return true;
  });

  // Supervisors are not in teams, so canDisableNotifications check only applies to managers
  const isNoneDisabled =
    isManager === true &&
    isSupervisor !== true &&
    canDisableNotifications === false;

  return (
    <section className="flex flex-col mt-16 gap-8">
      <h2 className="text-[32px] font-bold leading-[40px] text-[#161616]">
        Notifications par e-mail
      </h2>

      <Controller
        control={formMethods.control}
        name="notificationFrequency"
        render={({ field }) => (
          <RadioButtons
            legend="Choisissez la fréquence de réception des notifications :"
            options={availableOptions.map((option) => ({
              label: option.label,
              hintText:
                option.value === NotificationFrequency.NONE &&
                isNoneDisabled ? (
                  <p className="text-xs m-0 font-regular text-[#666666]">
                    Vous êtes le seul membre actif avec des notifications
                    activées dans au moins une de vos équipes.
                  </p>
                ) : option.hint ? (
                  <p className="text-xs m-0 font-regular text-[#666666]">
                    {option.hint}
                  </p>
                ) : undefined,
              nativeInputProps: {
                name: "notificationFrequency",
                value: option.value,
                checked: field.value === option.value,
                onChange: () => field.onChange(option.value),
                disabled:
                  option.value === NotificationFrequency.NONE && isNoneDisabled,
              },
            }))}
          />
        )}
      />
    </section>
  );
}
