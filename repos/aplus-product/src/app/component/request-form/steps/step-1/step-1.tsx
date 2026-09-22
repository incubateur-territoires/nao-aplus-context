import { ROUTE, SEARCH_PARAMS } from "@/app/constant/route";
import { Select } from "@codegouvfr/react-dsfr/Select";
import Button from "@codegouvfr/react-dsfr/Button";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { Controller, useFormContext } from "react-hook-form";
import { RequestedGroupsSelection } from "../../request-group-selection/request-group-selection";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ReportFormValues } from "../../request-form";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { Spinner } from "@/app/component/spinner/spinner";
import { useTRPC } from "@/trpc/client";
import { scrollToFirstError } from "../../utils/scroll";
import { stripEmptyAriaDescribedBy } from "@/utils/dsfr-select-a11y";

export function Step1() {
  const form = useFormContext<ReportFormValues>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const trpc = useTRPC();
  const [showExpiredAlert, setShowExpiredAlert] = useState(false);

  // Callback ref : pose le focus sur l'alerte au moment exact où elle entre dans
  // le DOM. Robuste au chargement (Spinner) — si l'alerte n'apparaît qu'une fois
  // les données chargées, le focus est posé à ce moment-là. Un simple useEffect
  // sur showExpiredAlert ne le ferait pas : il se déclencherait pendant le
  // Spinner, où le conteneur n'est pas encore rendu (ref null).
  const focusExpiredAlert = useCallback((node: HTMLDivElement | null) => {
    node?.focus();
  }, []);

  useEffect(() => {
    if (searchParams.get(SEARCH_PARAMS.FORM_EXPIRED) === "true") {
      setShowExpiredAlert(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete(SEARCH_PARAMS.FORM_EXPIRED);
      const remaining = params.toString();
      const newUrl = remaining ? `${pathname}?${remaining}` : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, pathname]);
  const {
    data: user,
    isLoading: isLoadingUser,
    error: errorUser,
  } = useQuery(trpc.user.getCurrentUser.queryOptions());
  const initialGroupsLength = new Set(user?.teams.map((team) => team.id)).size;

  const {
    data: areas,
    isLoading: isLoadingAreas,
    error: errorAreas,
  } = useQuery(trpc.area.getActiveAreas.queryOptions());

  const applicantTeam = form.watch("applicantTeam");
  const hasSetDefault = useRef(false);

  useEffect(() => {
    if (
      !hasSetDefault.current &&
      user?.teams &&
      user.teams.length > 0 &&
      initialGroupsLength > 1 &&
      (!applicantTeam || applicantTeam.length === 0)
    ) {
      const firstTeam = user.teams[0];
      form.setValue("applicantTeam", [
        { value: firstTeam.id, label: firstTeam.name },
      ]);
      hasSetDefault.current = true;
    }
  }, [user?.teams, applicantTeam, form, initialGroupsLength]);

  if (isLoadingUser || isLoadingAreas) return <Spinner />;
  if (errorUser || errorAreas) {
    return (
      <p className="text-red-500" role="alert">
        {errorUser?.message || errorAreas?.message}
      </p>
    );
  }

  const aleadyLinkedRequestedTeamsIds = applicantTeam.map(
    (group) => group.value,
  );
  return (
    <div className="flex flex-col gap-4">
      {showExpiredAlert && (
        <div ref={focusExpiredAlert} tabIndex={-1} className="mb-4">
          <Alert
            severity="info"
            title="Votre formulaire a expiré suite à un rafraîchissement de page. Veuillez le remplir à nouveau."
            closable
            onClose={() => setShowExpiredAlert(false)}
          />
        </div>
      )}
      <p className="mb-0">
        Tous les champs sont obligatoires sauf mention contraire.
      </p>
      {initialGroupsLength > 1 ? (
        <Controller
          control={form.control}
          name="applicantTeam"
          render={({ field }) => (
            <div className="flex flex-col gap-1 w-full sm:w-1/2">
              <Select
                state={
                  form.formState.errors.applicantTeam ? "error" : "default"
                }
                stateRelatedMessage={
                  form.formState.errors.applicantTeam?.message as string
                }
                label="Équipe autrice"
                className="w-full mt-4"
                nativeSelectProps={{
                  ref: stripEmptyAriaDescribedBy,
                  "aria-required": true,
                  value: field.value?.[0]?.value ?? "",
                  onChange: (e) => {
                    const previousTeamId = field.value?.[0]?.value;
                    const selectedApplicantTeam = user?.teams.find(
                      (team) => team.id === e.target.value,
                    );
                    if (selectedApplicantTeam) {
                      field.onChange([
                        {
                          value: selectedApplicantTeam.id,
                          label: selectedApplicantTeam.name,
                        },
                      ]);
                    } else {
                      field.onChange([]);
                    }
                    // Les co-auteurs sont des membres de l'équipe autrice : un
                    // changement d'équipe invalide la sélection, l'étape 4
                    // re-cochera les collègues de la nouvelle équipe.
                    if (selectedApplicantTeam?.id !== previousTeamId) {
                      form.setValue("colleagues", []);
                    }
                  },
                }}
              >
                <option value="" disabled>
                  Sélectionnez l&apos;équipe
                </option>
                {user?.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        />
      ) : null}
      <Controller
        control={form.control}
        name="area"
        render={({ field }) => (
          <div className="flex flex-col gap-1 w-full sm:w-1/2 mt-4">
            <Select
              data-testid="area-select"
              state={form.formState.errors.area ? "error" : "default"}
              stateRelatedMessage={
                form.formState.errors.area?.message as string
              }
              label={<>Territoire concerné</>}
              className="w-full"
              nativeSelectProps={{
                ref: stripEmptyAriaDescribedBy,
                "aria-required": true,
                value: field.value?.[0]?.value ?? "",
                onChange: (e) => {
                  const selectedArea = areas?.find(
                    (a) => a.id === e.target.value,
                  );
                  if (selectedArea) {
                    field.onChange([
                      { value: selectedArea.id, label: selectedArea.name },
                    ]);
                  } else {
                    field.onChange([]);
                  }
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

      <RequestedGroupsSelection
        aleadyLinkedRequestedTeamsIds={aleadyLinkedRequestedTeamsIds}
      />
      <div className="flex sm:justify-end mt-6 w-full ">
        <Button
          data-testid="step-1-submit-button"
          size="large"
          type="submit"
          iconPosition="right"
          iconId="ri-arrow-right-line"
          className=" w-full md:w-fit flex justify-center sm:min-w-fit"
          onClick={async (e) => {
            e.preventDefault();

            const isValid = await form.trigger([
              "area",
              "requestedTeams",
              "applicantTeam",
            ]);
            if (isValid) {
              router.push(ROUTE.NEW_REPORT_STEP_2);
            } else {
              scrollToFirstError();
            }
          }}
        >
          Étape 2 : informations du citoyen
        </Button>
      </div>
    </div>
  );
}
