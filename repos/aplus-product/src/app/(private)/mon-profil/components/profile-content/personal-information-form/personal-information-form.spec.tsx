import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { PersonalInformationForm } from "./personal-information-form";
import { ProfileFormValues } from "../profile-schema";
import { NotificationFrequency } from "@/generated/prisma/enums";

function createWrapper(defaultValues: ProfileFormValues) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const methods = useForm<ProfileFormValues>({
      defaultValues,
    });

    return <FormProvider {...methods}>{children}</FormProvider>;
  };
}

describe("PersonalInformationForm", () => {
  const defaultValues: ProfileFormValues = {
    firstName: "John",
    lastName: "Doe",
    phone: "0123456789",
    profession: "Developer",
    notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
  };

  it("renders all form fields", () => {
    render(<PersonalInformationForm />, {
      wrapper: createWrapper(defaultValues),
    });

    expect(screen.getByText("Informations personnelles")).toBeInTheDocument();
    expect(screen.getByLabelText("Prénom")).toBeInTheDocument();
    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
    expect(screen.getByLabelText("Profession (optionnel)")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Numéro de téléphone \(optionnel\)/),
    ).toBeInTheDocument();
  });

  it("displays default values", () => {
    render(<PersonalInformationForm />, {
      wrapper: createWrapper(defaultValues),
    });

    expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0123456789")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Developer")).toBeInTheDocument();
  });
});
