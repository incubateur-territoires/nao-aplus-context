"use client";

import { RenderSteps } from "./render-steps/render-steps";
import { FormProvider, useForm } from "react-hook-form";
import { reportFormSchema } from "@/app/component/request-form/request-form.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Faker } from "@faker-js/faker";
import { fr } from "@faker-js/faker";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, Suspense } from "react";
import { Spinner } from "../spinner/spinner";

export type ReportFormValues = z.infer<typeof reportFormSchema>;

export const customFaker = new Faker({
  locale: [fr],
});

export function RequestForm() {
  const trpc = useTRPC();
  const { data: user, isLoading } = useQuery(
    trpc.user.getCurrentUser.queryOptions(),
  );

  const userAreas = useMemo(
    () =>
      user?.teams.flatMap((team) =>
        team.areas.map((area) => ({
          value: area.id,
          label: area.name,
        })),
      ),
    [user?.teams],
  );

  const userGroupsLength = new Set(user?.teams.map((team) => team.id)).size;
  const userGroups = useMemo(
    () =>
      user?.teams.map((team) => ({
        value: team.id,
        label: team.name,
      })),
    [user?.teams],
  );

  const methods = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    mode: undefined,
    defaultValues: {
      area: [],
      requestedTeams: [],
      subject: "",
      description: "",
      files: [],
      firstName: "",
      lastName: "",
      phone: undefined,
      maritalName: undefined,
      birthDate: undefined,
      citizenPermissionConfirmed: false,
      colleagues: [],
      applicantTeam: [],
    },
  });

  // Set the area to the user's area if it's not already set
  useEffect(() => {
    if (userAreas?.[0]?.value && !methods.getValues("area")?.[0]?.value) {
      methods.setValue("area", [
        {
          value: userAreas[0].value,
          label: userAreas[0].label,
        },
      ]);
    }
  }, [userAreas, methods]);

  // Set the group to the user's group if it's not already set and if the user has only one group
  useEffect(() => {
    if (
      userGroupsLength === 1 &&
      userGroups?.[0] &&
      methods.getValues("applicantTeam").length === 0
    ) {
      methods.setValue("applicantTeam", [
        {
          value: userGroups[0].value,
          label: userGroups[0].label,
        },
      ]);
    }
  }, [userGroupsLength, userGroups, methods]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }
  return (
    <FormProvider {...methods}>
      <form className="mb-10 md:mb-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          }
        >
          <RenderSteps />
        </Suspense>
      </form>
    </FormProvider>
  );
}
