import { ReportFormValues } from "@/app/component/request-form/request-form";
import { FormProvider, useForm } from "react-hook-form";

export const initialValues: ReportFormValues = {
  area: [{ label: "Pas-de-Calais", value: "pas-de-calais" }],
  applicantTeam: [{ label: "Structure Test", value: "structure-test" }],
  requestedTeams: [
    {
      label: "CAF - Pas-de-Calais",
      value: "caf-pas-de-calais",
      specificFields: [
        {
          name: "nir",
          label: "NIR",
          errorMessage: "",
          hintText: "",
        },
        {
          name: "caf",
          label: "CAF",
          errorMessage: "",
          hintText: "",
        },
      ],
    },
  ],
  subject: "Sujet test",
  description: "Description test",
  files: [
    new File(["dummy content"], "Attestation décès.pdf"),
    new File(["dummy content"], "Document CAF.pdf"),
  ],
  caf: "CAF1234567",
  nir: "123456789012345",
  firstName: "Jean",
  lastName: "Dupont",
  birthDate: "2000-01-01",
  citizenPermissionConfirmed: true,
  colleagues: [],
};

export function RequestFormWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: ReportFormValues;
}) {
  const methods = useForm({
    defaultValues: defaultValues ?? initialValues,
    mode: "onChange",
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}
