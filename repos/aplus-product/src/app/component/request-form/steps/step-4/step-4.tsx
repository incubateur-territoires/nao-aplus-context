"use client";

import { ROUTE, SEARCH_PARAMS } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";
import { LinkButton } from "@/app/component/button/link/link";
import { useRouter } from "next/navigation";
import Checkbox from "@codegouvfr/react-dsfr/Checkbox";
import { Controller, useFormContext } from "react-hook-form";
import { ReportFormValues } from "../../request-form";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useUploadFiles } from "@/app/query/file/file.query";
import { Spinner } from "@/app/component/spinner/spinner";
import { getRequiredSpecificField } from "../../utils/specific-field.service";
import { formatPhoneNumber } from "@/utils/format";
import { generateMandatePdf } from "@/utils/generate-mandate-pdf";
import { findUnreadableFiles } from "@/utils/file";
import { useState, useCallback, useEffect, useRef } from "react";

export function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  const isString = typeof value === "string" || typeof value === "number";
  return (
    <li className="flex sm:gap-12 sm:flex-row flex-col list-none">
      <p className="sm:min-w-[200px]  max-w-[200px]">{label}</p>
      {isString ? (
        <p className="font-bold w-full sm:w-2/3 whitespace-pre-line">{value}</p>
      ) : (
        <div className="font-bold w-full  sm:w-2/3 whitespace-pre-line">
          {value}
        </div>
      )}
    </li>
  );
}

function Section({
  title,
  children,
  onEdit,
  className,
  hideBorder,
  modifyCtaLabel,
}: {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  className?: string;
  hideBorder?: boolean;
  modifyCtaLabel: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-lg font-bold fr-h6">{title}</h3>
      {/* Chaque catégorie du récapitulatif est structurée en liste (a11y) :
          la section est une <ul>, chaque ligne label/valeur est un <li>. */}
      <ul className="list-none p-0 m-0">{children}</ul>
      {onEdit && (
        <Button
          priority="tertiary"
          className="mb-4 "
          onClick={onEdit}
          type="button"
        >
          {modifyCtaLabel || "Modifier ces informations"}
        </Button>
      )}
      {!hideBorder ? (
        <div className="mt-8 mb-4">
          <hr />
        </div>
      ) : (
        <div className="mt-8 mb-4" />
      )}
    </div>
  );
}

export function Step4() {
  const router = useRouter();
  const form = useFormContext<ReportFormValues>();
  const { getValues, control, watch } = form;
  const trpc = useTRPC();
  const [mandatePdfBlob, setMandatePdfBlob] = useState<Blob | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const requiredFields = getRequiredSpecificField(getValues("requestedTeams"));

  const handleMandateGeneration = useCallback(
    async (checked: boolean) => {
      if (checked) {
        const formValues = getValues();
        const citizenName =
          `${formValues.firstName} ${formValues.lastName}`.trim();
        const birthDate = formValues.birthDate
          ? new Date(formValues.birthDate).toLocaleDateString("fr-FR")
          : "";
        const teamName =
          formValues.applicantTeam.map((t) => t.label).join(", ") || "";

        const pdfBytes = await generateMandatePdf({
          citizenName,
          birthDate,
          teamName,
        });
        setMandatePdfBlob(
          new Blob([pdfBytes.buffer as ArrayBuffer], {
            type: "application/pdf",
          }),
        );
      } else {
        setMandatePdfBlob(null);
      }
    },
    [getValues],
  );

  function handleViewMandate() {
    if (!mandatePdfBlob) return;
    const url = URL.createObjectURL(mandatePdfBlob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const { mutateAsync: uploadFiles, isPending: isUploadingFiles } =
    useUploadFiles();
  const applicantTeamId = getValues("applicantTeam")[0]?.value;

  const { data: colleagues, isLoading: isLoadingColleagues } = useQuery(
    trpc.report.getColleagues.queryOptions(applicantTeamId),
  );

  // Pré-remplit tous les co-auteurs par défaut. Le ref garantit qu'on ne
  // re-remplit pas après une interaction utilisateur (notamment quand il
  // décoche le dernier item, ce qui fait revenir RHF à la valeur par défaut
  // et réinitialiserait dirtyFields).
  const hasInitializedColleagues = useRef(false);
  useEffect(() => {
    if (!colleagues || colleagues.length === 0) return;
    if (hasInitializedColleagues.current) return;

    hasInitializedColleagues.current = true;

    if ((form.getValues("colleagues") ?? []).length > 0) return;

    form.setValue(
      "colleagues",
      colleagues.map((colleague) => ({
        value: colleague.id,
        label:
          colleague.firstName && colleague.lastName
            ? `${colleague.firstName} ${colleague.lastName}`
            : colleague.email,
      })),
    );
  }, [colleagues, form]);

  const {
    mutateAsync: createReport,
    isPending: isCreatingReport,
    isError,
    error,
  } = useMutation(
    trpc.report.createReport.mutationOptions({
      onSuccess: () => {
        router.push(
          `${ROUTE.ALL_REPORTS}?success=${SEARCH_PARAMS.REPORT_CREATED}`,
        );
      },
      onError: (error) => {
        console.error(error);
      },
    }),
  );

  async function handleSubmit() {
    setUploadError(null);
    const isValid = await form.trigger(["citizenPermissionConfirmed"]);
    if (isValid) {
      try {
        const formValues = getValues();

        // Les fichiers ont été sélectionnés à l'étape 3 : ils peuvent avoir été
        // déplacés ou supprimés du disque depuis. On le détecte ici pour donner
        // un message clair plutôt qu'une erreur d'upload opaque.
        const unreadableFiles = await findUnreadableFiles(formValues.files);
        if (unreadableFiles.length > 0) {
          const fileNames = unreadableFiles
            .map((file) => `« ${file.name} »`)
            .join(", ");
          setUploadError(
            `Le ou les fichiers suivants ne sont plus accessibles sur votre appareil : ${fileNames}. ` +
              `Ils ont peut-être été déplacés, renommés ou supprimés depuis l'étape 3. ` +
              `Revenez à l'étape 3 pour les retirer ou les ajouter de nouveau, puis renvoyez le signalement.`,
          );
          return;
        }

        // Prepend mandate PDF to files if available
        const filesToUpload = [...formValues.files];
        if (mandatePdfBlob) {
          const mandateFile = new File([mandatePdfBlob], "Mandat.pdf", {
            type: "application/pdf",
          });
          filesToUpload.unshift(mandateFile);
        }

        // Upload files using the query hook
        const uploadResult = await uploadFiles(filesToUpload);

        if (uploadResult.ok && uploadResult.data) {
          // Convert lastModified to Date objects for request creation schema
          const filesWithDateObjects = uploadResult.data.map(
            (file: {
              id: string;
              name: string;
              size: number;
              type: string;
              lastModified: Date;
            }) => ({
              ...file,
              lastModified: new Date(file.lastModified),
            }),
          );

          // Then create the request with the uploaded file metadata
          await createReport({
            ...formValues,
            files: filesWithDateObjects,
          });
        } else {
          setUploadError(
            uploadResult.message ||
              "Erreur lors de l'envoi des fichiers. Veuillez réessayer.",
          );
        }
      } catch (error) {
        console.error(error);
        setUploadError(
          "Une erreur est survenue lors de l'envoi. Veuillez réessayer.",
        );
      }
    }
  }

  if (isLoadingColleagues) return <Spinner />;
  return (
    <div>
      <Section
        title="Destinataires du signalement"
        onEdit={() => router.push(ROUTE.NEW_REPORT_STEP_1)}
        modifyCtaLabel="Modifier les informations du destinataire"
      >
        <InfoRow
          label="Équipe autrice"
          value={getValues("applicantTeam")
            ?.map((t) => t.label)
            .join("\n")}
        />
        <InfoRow
          label="Territoire concerné"
          value={getValues("area")
            ?.map((t) => t.label)
            .join("\n")}
        />
        <InfoRow
          label="Équipe(s) opérateur à contacter"
          value={getValues("requestedTeams")
            .map((o) => o.label)
            .join("\n")}
        />
      </Section>

      <Section
        title="Informations du citoyen"
        onEdit={() => router.push(ROUTE.NEW_REPORT_STEP_2)}
        modifyCtaLabel="Modifier les informations du citoyen"
      >
        <InfoRow label="Prénom" value={getValues("firstName")} />
        <InfoRow label="Nom" value={getValues("lastName")} />
        <InfoRow
          label="Date de naissance"
          value={
            getValues("birthDate")
              ? new Date(getValues("birthDate") ?? "").toLocaleDateString()
              : ""
          }
        />
        <InfoRow
          label="Numéro de téléphone"
          value={
            getValues("phone") === null
              ? "Le citoyen ne peut pas fournir son numéro de téléphone"
              : getValues("phone")
                ? formatPhoneNumber(getValues("phone"))
                : ""
          }
        />
        {getValues("maritalName") && (
          <InfoRow label="Nom marital" value={getValues("maritalName") ?? ""} />
        )}
        {(getValues("nir") ||
          (getValues("nir") === null && requiredFields.includes("nir"))) && (
          <InfoRow
            label="Numéro  NIR"
            value={
              getValues("nir") === null
                ? "Le citoyen ne peut pas fournir son numéro"
                : getValues("nir")
            }
          />
        )}
        {(getValues("caf") ||
          (getValues("caf") === null && requiredFields.includes("caf"))) && (
          <InfoRow
            label="Identifiant CAF"
            value={
              getValues("caf") === null
                ? "Le citoyen ne peut pas fournir son identifiant"
                : getValues("caf")
            }
          />
        )}
        {(getValues("nif") ||
          (getValues("nif") === null && requiredFields.includes("nif"))) && (
          <InfoRow
            label="Numéro d'identification fiscale NIF"
            value={
              getValues("nif") === null
                ? "Le citoyen ne peut pas fournir son numéro"
                : getValues("nif")
            }
          />
        )}
      </Section>

      <Section
        title="Signalement détaillé"
        onEdit={() => router.push(ROUTE.NEW_REPORT_STEP_3)}
        hideBorder
        className="md:mb-30 mb-10"
        modifyCtaLabel="Modifier le contenu du signalement"
      >
        <InfoRow label="Sujet du signalement" value={getValues("subject")} />
        <InfoRow
          label="Description du blocage"
          value={getValues("description")}
        />

        {getValues("files")?.length > 0 ? (
          <InfoRow
            label="Fichier(s) joint(s)"
            value={
              <div className="flex flex-col ">
                {getValues("files").map((file) => {
                  function handleFileClick() {
                    const url = URL.createObjectURL(file);
                    const link = document.createElement("a");
                    link.href = url;
                    link.target = "_blank";
                    link.click();
                    // Clean up the object URL after a short delay
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }

                  return (
                    <Button
                      priority="tertiary no outline"
                      key={file.name}
                      className="underline text-black m-0 bg-transparent border-none p-0 hover:text-blue-primary last:mb-6"
                      onClick={handleFileClick}
                      type="button"
                    >
                      {file.name}
                    </Button>
                  );
                })}
              </div>
            }
          />
        ) : null}
      </Section>
      <div className="bg-blue-background w-full h-10 absolute left-0 " />
      {colleagues && colleagues.length > 0 && (
        <>
          <div className="lg:pt-30 py-20 relative">
            <Controller
              control={control}
              name="colleagues"
              render={({ field }) => {
                return (
                  <Checkbox
                    id="colleagues-fieldset"
                    // Le DSFR référence par défaut le message d'erreur dans
                    // aria-labelledby (donc dans le *nom* du groupe). On limite le
                    // nom à la légende et on expose l'erreur comme *description*
                    // via aria-describedby (a11y).
                    aria-labelledby="colleagues-fieldset-legend"
                    aria-describedby="colleagues-fieldset-messages"
                    legend={
                      <span className="text-lg font-bold fr-h6">
                        Inviter des collègues (optionnel)
                      </span>
                    }
                    state={
                      form.formState.errors.colleagues ? "error" : "default"
                    }
                    stateRelatedMessage={
                      form.formState.errors.colleagues?.message
                    }
                    options={colleagues.map((colleague) => {
                      const colleagueLabel =
                        colleague.firstName && colleague.lastName
                          ? `${colleague.firstName} ${colleague.lastName}`
                          : colleague.email;
                      return {
                        label: colleagueLabel,
                        nativeInputProps: {
                          type: "checkbox",
                          name: "colleagues",
                          checked: (field.value || []).some(
                            (item) => item?.value === colleague.id,
                          ),
                          onChange: (e) => {
                            if (e.target.checked) {
                              field.onChange([
                                ...(field.value || []),
                                {
                                  value: colleague.id,
                                  label: colleagueLabel,
                                },
                              ]);
                            } else {
                              field.onChange(
                                (field.value || []).filter(
                                  (item) => item?.value !== colleague.id,
                                ),
                              );
                            }
                          },
                        },
                      };
                    })}
                  />
                );
              }}
            />
          </div>
        </>
      )}
      <div className="bg-blue-background w-full h-10 absolute left-0 " />

      <div
        className={`mb-10 ${colleagues && colleagues.length === 0 ? "pt-20" : ""}`}
      >
        <h3 className="relative z-10 pt-30 text-lg font-bold fr-h6">
          Mandat (obligatoire)
        </h3>
        <Controller
          control={control}
          name="citizenPermissionConfirmed"
          render={({ field }) => (
            <Checkbox
              data-testid="citizenPermissionConfirmed-checkbox"
              state={
                form.formState.errors.citizenPermissionConfirmed
                  ? "error"
                  : "default"
              }
              stateRelatedMessage={
                form.formState.errors.citizenPermissionConfirmed?.message
              }
              options={[
                {
                  hintText: "Un mandat sera automatiquement généré.",
                  label: (
                    <span>
                      J&apos;atteste avoir recueilli l&apos;autorisation du
                      citoyen
                    </span>
                  ),

                  nativeInputProps: {
                    type: "checkbox",
                    name: "citizenPermissionConfirmed",
                    checked: field.value,
                    onChange: (e) => {
                      field.onChange(e.target.checked);
                      form.trigger("citizenPermissionConfirmed");
                      handleMandateGeneration(e.target.checked);
                    },
                  },
                },
              ]}
            />
          )}
        />
        {watch("citizenPermissionConfirmed") && mandatePdfBlob ? (
          <Button
            priority="tertiary"
            className="mt-4"
            size="small"
            onClick={handleViewMandate}
            type="button"
          >
            Voir le mandat
          </Button>
        ) : null}
      </div>
      {isError && (
        <p className="text-red-500" role="alert">
          {error.message}
        </p>
      )}
      {uploadError && (
        <p className="text-red-500" role="alert">
          {uploadError}
        </p>
      )}

      <div className="flex justify-between sm:flex-row-reverse flex-col mt-6 gap-6  sm:items-center">
        <Button
          data-testid="step-4-submit-button"
          size="large"
          type="button"
          iconPosition="right"
          iconId="ri-arrow-right-line"
          className=" w-full md:w-fit flex justify-center sm:min-w-fit"
          onClick={handleSubmit}
          disabled={isUploadingFiles || isCreatingReport}
        >
          Envoyer le signalement
        </Button>
        <div className="w-auto">
          <LinkButton
            label="Retour à l'étape 3"
            href={ROUTE.NEW_REPORT_STEP_3}
            role="button"
          />
        </div>
      </div>
    </div>
  );
}
