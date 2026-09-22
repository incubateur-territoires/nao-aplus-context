"use client";

import { ROUTE } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";
import { useRouter } from "next/navigation";
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { LinkButton } from "@/app/component/button/link/link";
import { ReportFormValues } from "../../request-form";
import { InputFile } from "@/app/component/ui/input-file/input-file";
import { scrollToFirstError } from "../../utils/scroll";
export function Step3() {
  const form = useFormContext<ReportFormValues>();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <p className="mb-0">
        Tous les champs sont obligatoires sauf mention contraire.
      </p>
      <Controller
        control={form.control}
        name="subject"
        render={({ field }) => (
          <Input
            state={form.formState.errors.subject ? "error" : "default"}
            stateRelatedMessage={
              (form.formState.errors.subject?.message as string) ||
              "Veuillez saisir le sujet du signalement du citoyen. Attention : le sujet ne doit pas contenir de données personnelles (nom ou numéro de sécurité sociale par exemple)"
            }
            label={<>Sujet du signalement</>}
            {...field}
            hintText="Le sujet du signalement ne doit pas contenir de données personnelles (nom ou numéro de sécurité sociale par exemple)."
            nativeInputProps={{
              type: "text",
              "aria-required": true,
              value: field.value,
              onChange: (e) => {
                field.onChange(e.target.value);
              },
            }}
          />
        )}
      />
      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <Input
            state={form.formState.errors.description ? "error" : "default"}
            stateRelatedMessage={
              (form.formState.errors.description?.message as string) ||
              "Veuillez saisir une description précise du blocage du citoyen. Vous pouvez fournir autant de détails que nécessaire."
            }
            label="Description du blocage"
            textArea
            {...field}
            hintText="La description du blocage ne doit pas contenir de données personnelles (nom ou numéro de sécurité sociale par exemple)."
            nativeTextAreaProps={{
              value: field.value,
              "aria-required": true,
              rows: 5,
              onChange: (e) => {
                field.onChange(e.target.value);
              },
            }}
          />
        )}
      />
      <Controller
        control={form.control}
        name="files"
        render={({ field }) => <InputFile {...field} />}
      />

      <div className="flex justify-between sm:flex-row-reverse flex-col mt-6 gap-6  sm:items-center">
        <Button
          data-testid="step-3-submit-button"
          size="large"
          type="submit"
          iconPosition="right"
          iconId="ri-arrow-right-line"
          className=" w-full md:w-fit flex justify-center sm:min-w-fit"
          onClick={async (e) => {
            e.preventDefault();
            const isValid = await form.trigger(["subject", "description"]);
            if (isValid) {
              router.push(ROUTE.NEW_REPORT_STEP_4);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              scrollToFirstError();
            }
          }}
        >
          Étape 4 : récapitulatif et validation
        </Button>
        <div className="w-auto">
          <LinkButton
            label="Retour à l'étape 2"
            href={ROUTE.NEW_REPORT_STEP_2}
            role="button"
          />
        </div>
      </div>
    </div>
  );
}
