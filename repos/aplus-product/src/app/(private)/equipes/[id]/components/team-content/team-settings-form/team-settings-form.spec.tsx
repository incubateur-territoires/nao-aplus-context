import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { useEffect } from "react";
import { TeamSettingsForm } from "./team-settings-form";
import { TeamSettingsFormValues } from "../team-settings-schema";

function createWrapper(defaultValues: TeamSettingsFormValues) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const methods = useForm<TeamSettingsFormValues>({
      defaultValues,
    });

    return <FormProvider {...methods}>{children}</FormProvider>;
  };
}

describe("TeamSettingsForm", () => {
  const defaultValues: TeamSettingsFormValues = {
    name: "Test Team",
    email: "test@example.com",
    description: "Test description",
  };

  it("renders all form fields", () => {
    render(<TeamSettingsForm />, {
      wrapper: createWrapper(defaultValues),
    });

    expect(
      screen.getByLabelText("Nom de l'équipe (obligatoire)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Adresse e-mail de l'équipe (optionnel)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Description (optionnel)")).toBeInTheDocument();
  });

  it("displays default values", () => {
    render(<TeamSettingsForm />, {
      wrapper: createWrapper(defaultValues),
    });

    expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test description")).toBeInTheDocument();
  });

  it("shows email hint text", () => {
    render(<TeamSettingsForm />, {
      wrapper: createWrapper(defaultValues),
    });

    expect(
      screen.getByText(
        "Adresse générique pour inscriptions et notifications. Format attendu : nom@domaine.fr",
      ),
    ).toBeInTheDocument();
  });

  it("renders info alert", () => {
    render(<TeamSettingsForm />, {
      wrapper: createWrapper(defaultValues),
    });

    expect(
      screen.getByText(
        "Pour apporter une précision, par exemple les villes ou les quartiers concernées, ou toute autre information utile concernant l'équipe.",
      ),
    ).toBeInTheDocument();
  });

  it("handles empty optional fields", () => {
    const valuesWithoutOptional: TeamSettingsFormValues = {
      name: "Test Team",
      email: null,
      description: null,
    };

    const { container } = render(<TeamSettingsForm />, {
      wrapper: createWrapper(valuesWithoutOptional),
    });

    expect(screen.getByDisplayValue("Test Team")).toBeInTheDocument();
    const emailInput = container.querySelector(
      'input[type="email"]',
    ) as HTMLInputElement;
    expect(emailInput?.value).toBe("");
  });

  it("displays error messages when validation fails", () => {
    function ErrorWrapper({ children }: { children: React.ReactNode }) {
      const methods = useForm<TeamSettingsFormValues>({
        defaultValues,
      });

      useEffect(() => {
        methods.setError("name", {
          type: "required",
          message: "Le nom de l'équipe est obligatoire.",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return <FormProvider {...methods}>{children}</FormProvider>;
    }

    render(<TeamSettingsForm />, {
      wrapper: ErrorWrapper,
    });

    expect(
      screen.getByText("Le nom de l'équipe est obligatoire."),
    ).toBeInTheDocument();
  });
});
