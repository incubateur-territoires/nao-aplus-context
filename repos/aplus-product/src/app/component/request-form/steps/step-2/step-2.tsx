"use client";

import { ROUTE } from "@/app/constant/route";
import Button from "@codegouvfr/react-dsfr/Button";
import { LinkButton } from "@/app/component/button/link/link";
import { useRouter } from "next/navigation";
import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { ReportFormValues } from "../../request-form";
import { getRequiredSpecificField } from "../../utils/specific-field.service";
import Checkbox from "@codegouvfr/react-dsfr/Checkbox";
import { scrollToFirstError } from "../../utils/scroll";
import { useEffect } from "react";

interface FieldConfig {
  name: "nir" | "caf" | "nif";
  label: string;
  hintText: string;
}

const IDENTITY_FIELDS: FieldConfig[] = [
  {
    name: "nir",
    label: "Numéro de sécurité sociale NIR",
    hintText: "13 ou 15 chiffres",
  },
  {
    name: "caf",
    label: "Identifiant CAF",
    hintText: "7 chiffres",
  },
  {
    name: "nif",
    label: "Numéro d'identification fiscale NIF",
    hintText: "13 chiffres",
  },
];

export function Step2() {
  const form = useFormContext<ReportFormValues>();
  const router = useRouter();

  const requiredSpecificField = getRequiredSpecificField(
    form.watch("requestedTeams"),
  );

  // Le numéro de téléphone est obligatoire (sauf si la case « ne peut pas
  // fournir » est cochée). On initialise la valeur à "" au montage pour forcer
  // la validation au submit, comme pour les champs NIR / CAF / NIF.
  useEffect(() => {
    if (form.getValues("phone") === undefined) {
      form.setValue("phone", "");
    }
  }, [form]);

  function RenderIdentityField(fieldConfig: FieldConfig) {
    const { name, label, hintText } = fieldConfig;
    const error = form.formState.errors[name];

    // i need to set the value to "" when the component mount and the value is undefined, to force validation on submit ...
    useEffect(() => {
      if (form.getValues(name) === undefined) {
        form.setValue(name, "");
      }
    }, [name]);

    return (
      <fieldset key={name} className="border-0 p-0 m-0 min-w-0">
        <legend className="sr-only">{label}</legend>
        <Controller
          key={name}
          control={form.control}
          name={name}
          render={({ field }) => (
            <Input
              disabled={field.value === null}
              state={error ? "error" : "default"}
              stateRelatedMessage={error?.message || ""}
              hintText={hintText}
              className="sm:w-1/2 w-full"
              {...field}
              label={label}
              nativeInputProps={{
                value: field.value ?? "",
                onChange: (e) => {
                  field.onChange(e.target.value);
                },
              }}
            />
          )}
        />
        <Controller
          control={form.control}
          name={name}
          render={({ field: inputField }) => (
            <Checkbox
              className="mt-4"
              options={[
                {
                  label: `Le citoyen ne peut pas fournir son ${name === "caf" ? "identifiant" : "numéro"}`,
                  nativeInputProps: {
                    name: inputField?.name,
                    checked: inputField.value === null,
                    onChange: (e) => {
                      inputField.onChange(e.target.checked ? null : "");
                      form.trigger(name);
                    },
                  },
                },
              ]}
            />
          )}
        />
      </fieldset>
    );
  }

  const hasOperatorRequiredFields = requiredSpecificField.length > 0;

  return (
    <div className="flex flex-col gap-12">
      <p className="mb-0">
        Tous les champs sont obligatoires sauf mention contraire.
      </p>
      <section aria-labelledby="step-2-identity-title">
        <h3
          id="step-2-identity-title"
          className="text-lg font-bold fr-h6 mt-0 mb-8"
        >
          Identité
        </h3>
        <div className="flex flex-col gap-12 [&_.fr-input-group]:!mb-0">
          <Controller
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <Input
                state={form.formState.errors.firstName ? "error" : "default"}
                stateRelatedMessage={
                  <span data-testid="firstName-messages">
                    {form.formState.errors.firstName?.message ||
                      "Veuillez renseigner un prénom."}
                  </span>
                }
                className="sm:w-1/2 w-full"
                {...field}
                label={<>Prénom</>}
                nativeInputProps={{
                  autoComplete: "given-name",
                  "aria-required": true,
                  type: "text",
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
            name="lastName"
            render={({ field }) => (
              <Input
                state={form.formState.errors.lastName ? "error" : "default"}
                stateRelatedMessage={
                  <span data-testid="lastName-messages">
                    {form.formState.errors.lastName?.message ||
                      "Veuillez renseigner un nom."}
                  </span>
                }
                className="sm:w-1/2 w-full"
                {...field}
                label="Nom"
                nativeInputProps={{
                  autoComplete: "family-name",
                  "aria-required": true,
                  type: "text",
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
            name="birthDate"
            render={({ field }) => (
              <Input
                state={form.formState.errors.birthDate ? "error" : "default"}
                stateRelatedMessage={
                  <span data-testid="birthDate-messages">
                    {form.formState.errors.birthDate?.message || ""}
                  </span>
                }
                hintText="Au format jj / mm / aaaa"
                className="sm:w-1/2 w-full"
                {...field}
                label="Date de naissance"
                nativeInputProps={{
                  autoComplete: "bday",
                  "aria-required": true,
                  type: "date",
                  max: "9999-12-31",
                  value: field.value ?? "",
                  onChange: (e) => {
                    field.onChange(e.target.value);
                  },
                }}
              />
            )}
          />
          <fieldset className="border-0 p-0 m-0 min-w-0">
            <legend className="sr-only">Numéro de téléphone</legend>
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <Input
                  disabled={field.value === null}
                  state={form.formState.errors.phone ? "error" : "default"}
                  stateRelatedMessage={
                    <span data-testid="phone-messages">
                      {form.formState.errors.phone?.message || ""}
                    </span>
                  }
                  hintText="Au format 0612345678 ou +33612345678"
                  className="sm:w-1/2 w-full"
                  label="Numéro de téléphone"
                  nativeInputProps={{
                    ref: field.ref,
                    name: field.name,
                    autoComplete: "tel",
                    "aria-required": true,
                    type: "tel",
                    value: field.value ?? "",
                    onChange: (e) => {
                      const filtered = e.target.value
                        .replace(/[^0-9+\s]/g, "")
                        .replace(/\+/g, (match, offset) =>
                          offset === 0 ? match : "",
                        );
                      field.onChange(filtered);
                    },
                    onBlur: field.onBlur,
                  }}
                />
              )}
            />
            <Controller
              control={form.control}
              name="phone"
              render={({ field: inputField }) => (
                <Checkbox
                  className="mt-4"
                  options={[
                    {
                      label:
                        "Le citoyen ne peut pas fournir son numéro de téléphone",
                      nativeInputProps: {
                        checked: inputField.value === null,
                        onChange: (e) => {
                          inputField.onChange(e.target.checked ? null : "");
                          form.trigger("phone");
                        },
                      },
                    },
                  ]}
                />
              )}
            />
          </fieldset>
          <Controller
            control={form.control}
            name="maritalName"
            render={({ field }) => (
              <Input
                className="sm:w-1/2 w-full"
                label="Nom marital (optionnel)"
                nativeInputProps={{
                  ...field,
                  value: field.value ?? "",
                  onChange: (e) => field.onChange(e.target.value),
                }}
              />
            )}
          />
        </div>
      </section>

      {hasOperatorRequiredFields && (
        <>
          <hr className="my-0" />

          <section aria-labelledby="step-2-operator-title">
            <h3
              id="step-2-operator-title"
              className="text-lg font-bold fr-h6 mt-0 mb-8"
            >
              Informations demandées par le ou les opérateur(s)
            </h3>
            <div className="flex flex-col gap-12 [&_.fr-input-group]:!mb-0">
              {IDENTITY_FIELDS.map((fieldConfig) =>
                requiredSpecificField.includes(fieldConfig.name)
                  ? RenderIdentityField(fieldConfig)
                  : null,
              )}
            </div>
          </section>
        </>
      )}

      <div className="flex justify-between sm:flex-row-reverse flex-col mt-6 gap-6  sm:items-center">
        <Button
          data-testid="step-2-submit-button"
          size="large"
          type="submit"
          iconPosition="right"
          iconId="ri-arrow-right-line"
          className=" w-full md:w-fit flex justify-center sm:min-w-fit"
          onClick={async (e) => {
            e.preventDefault();
            const isValid = await form.trigger([
              "firstName",
              "lastName",
              "birthDate",
              "caf",
              "nir",
              "nif",
              "phone",
            ]);

            if (isValid) {
              router.push(ROUTE.NEW_REPORT_STEP_3);
            } else {
              scrollToFirstError();
            }
          }}
        >
          Étape 3 : signalement détaillé
        </Button>
        <div className="w-auto">
          <LinkButton
            label="Retour à l'étape 1"
            href={ROUTE.NEW_REPORT_STEP_1}
            role="button"
          />
        </div>
      </div>
    </div>
  );
}
