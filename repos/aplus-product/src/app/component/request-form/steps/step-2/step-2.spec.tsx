import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Step2 } from "./step-2";
import {
  RequestFormWrapper,
  initialValues,
} from "@/test/utils/request-form.wrapper";

const mockPush = jest.fn();

// Mock scrollToFirstError (relies on scrollIntoView, not available in jsdom)
jest.mock("../../utils/scroll", () => ({
  scrollToFirstError: jest.fn(),
}));

jest.mock("next/navigation", () => {
  const actual = jest.requireActual("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
    }),
  };
});

describe("Step2", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders all fields", () => {
    render(<Step2 />, { wrapper: RequestFormWrapper });
    expect(screen.getByLabelText(/Prénom/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nom" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date de naissance/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Étape 3/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Retour à l'étape 1/i }),
    ).toBeInTheDocument();
  });

  it("submits valid data and navigates to step 3", async () => {
    const user = userEvent.setup();
    render(<Step2 />, { wrapper: RequestFormWrapper });
    const firstName = screen.getByLabelText(/Prénom/i);
    const lastName = screen.getByRole("textbox", { name: "Nom" });
    const birthDate = screen.getByLabelText(/Date de naissance/i);
    const phone = screen.getByRole("textbox", {
      name: /Numéro de téléphone/i,
    });
    const button = screen.getByRole("button", { name: /Étape 3/i });
    await user.type(firstName, "Jean");
    await user.type(lastName, "Dupont");
    await user.type(birthDate, "2000-01-01");
    await user.type(phone, "0612345678");
    await user.click(button);
    expect(mockPush).toHaveBeenCalledWith("/signalement?step=3");
  });

  it("link to step 1 has correct href", () => {
    render(<Step2 />, { wrapper: RequestFormWrapper });
    const link = screen.getByRole("button", { name: /Retour à l'étape 1/i });
    expect(link).toHaveAttribute("href", "/signalement?step=1");
  });

  it("allows typing in birth date field", async () => {
    const user = userEvent.setup();
    render(<Step2 />, { wrapper: RequestFormWrapper });

    const birthDateInput = screen.getByLabelText(/Date de naissance/i);
    await user.clear(birthDateInput);
    await user.type(birthDateInput, "2000-01-01");

    expect(birthDateInput).toHaveValue("2000-01-01");
  });

  it("allows clearing and typing in required fields", async () => {
    const user = userEvent.setup();
    render(<Step2 />, { wrapper: RequestFormWrapper });

    const firstNameInput = screen.getByLabelText(/Prénom/i);
    const lastNameInput = screen.getByRole("textbox", { name: "Nom" });

    // Clear and type in required fields
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Marie");
    await user.clear(lastNameInput);
    await user.type(lastNameInput, "Martin");

    expect(firstNameInput).toHaveValue("Marie");
    expect(lastNameInput).toHaveValue("Martin");
  });

  it("filters non-numeric characters from phone input except leading +", async () => {
    const user = userEvent.setup();
    render(<Step2 />, { wrapper: RequestFormWrapper });
    const phoneInput = screen.getByRole("textbox", {
      name: /Numéro de téléphone/i,
    });
    await user.type(phoneInput, "+33abc613 986def250+++");
    expect(phoneInput).toHaveValue("+33613 986250");
  });

  it("renders phone 'cannot provide' checkbox in the identity section", () => {
    render(<Step2 />, { wrapper: RequestFormWrapper });
    expect(
      screen.getByRole("checkbox", {
        name: /Le citoyen ne peut pas fournir son numéro de téléphone/i,
      }),
    ).toBeInTheDocument();
  });

  it("disables phone input when 'cannot provide' checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<Step2 />, { wrapper: RequestFormWrapper });
    const phoneInput = screen.getByRole("textbox", {
      name: /Numéro de téléphone/i,
    });
    const checkbox = screen.getByRole("checkbox", {
      name: /Le citoyen ne peut pas fournir son numéro de téléphone/i,
    });

    expect(phoneInput).toBeEnabled();
    await user.click(checkbox);
    expect(phoneInput).toBeDisabled();
  });

  it("re-enables phone input when 'cannot provide' checkbox is unchecked", async () => {
    const user = userEvent.setup();
    render(<Step2 />, { wrapper: RequestFormWrapper });
    const phoneInput = screen.getByRole("textbox", {
      name: /Numéro de téléphone/i,
    });
    const checkbox = screen.getByRole("checkbox", {
      name: /Le citoyen ne peut pas fournir son numéro de téléphone/i,
    });

    await user.click(checkbox);
    expect(phoneInput).toBeDisabled();
    await user.click(checkbox);
    expect(phoneInput).toBeEnabled();
  });

  it("navigates to step 3 when the phone 'cannot provide' checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<Step2 />, { wrapper: RequestFormWrapper });
    const firstName = screen.getByLabelText(/Prénom/i);
    const lastName = screen.getByRole("textbox", { name: "Nom" });
    const birthDate = screen.getByLabelText(/Date de naissance/i);
    const phoneCheckbox = screen.getByRole("checkbox", {
      name: /Le citoyen ne peut pas fournir son numéro de téléphone/i,
    });
    const button = screen.getByRole("button", { name: /Étape 3/i });

    await user.type(firstName, "Jean");
    await user.type(lastName, "Dupont");
    await user.type(birthDate, "2000-01-01");
    await user.click(phoneCheckbox);
    await user.click(button);

    expect(mockPush).toHaveBeenCalledWith("/signalement?step=3");
  });

  it("renders nom marital field in the identity section", () => {
    render(<Step2 />, { wrapper: RequestFormWrapper });
    expect(screen.getByLabelText(/Nom marital/i)).toBeInTheDocument();
  });

  it("allows typing in nom marital field", async () => {
    const user = userEvent.setup();
    render(<Step2 />, { wrapper: RequestFormWrapper });
    const maritalInput = screen.getByLabelText(/Nom marital/i);
    await user.type(maritalInput, "Dupont-Martin");
    expect(maritalInput).toHaveValue("Dupont-Martin");
  });

  it("renders identity fields when required by requestedGroups", () => {
    const WrapperWithRequiredFields = ({
      children,
    }: {
      children: React.ReactNode;
    }) => {
      const formDefaultValues = {
        ...initialValues,
        requestedGroups: [
          {
            label: "Test Group",
            value: "test-group",
            specificFields: [
              {
                name: "nir" as const,
                label: "NIR Test",
                errorMessage: "NIR required",
                hintText: "13 ou 15 chiffres",
              },
            ],
          },
        ],
      };

      return (
        <RequestFormWrapper defaultValues={formDefaultValues}>
          {children}
        </RequestFormWrapper>
      );
    };

    render(<Step2 />, { wrapper: WrapperWithRequiredFields });

    expect(
      screen.getAllByText("Numéro de sécurité sociale NIR")[0],
    ).toBeInTheDocument();
    expect(
      screen.getByText("Le citoyen ne peut pas fournir son numéro"),
    ).toBeInTheDocument();
  });

  it("disables identity field input when checkbox is checked", async () => {
    const user = userEvent.setup();

    const WrapperWithRequiredFields = ({
      children,
    }: {
      children: React.ReactNode;
    }) => {
      const formDefaultValues = {
        ...initialValues,
        nir: "",
        requestedGroups: [
          {
            label: "Test Group",
            value: "test-group",
            specificFields: [
              {
                name: "nir" as const,
                label: "NIR Test",
                errorMessage: "NIR required",
                hintText: "13 ou 15 chiffres",
              },
            ],
          },
        ],
      };

      return (
        <RequestFormWrapper defaultValues={formDefaultValues}>
          {children}
        </RequestFormWrapper>
      );
    };

    render(<Step2 />, { wrapper: WrapperWithRequiredFields });

    const nirInput = screen.getByRole("textbox", {
      name: /Numéro de sécurité sociale NIR/i,
    });
    const checkbox = screen.getByRole("checkbox", {
      name: "Le citoyen ne peut pas fournir son numéro",
    });

    expect(nirInput).toBeEnabled();

    await user.click(checkbox);

    expect(nirInput).toBeDisabled();

    await user.click(checkbox);

    expect(nirInput).toBeEnabled();
  });

  it("submits successfully with valid identity field format", async () => {
    const user = userEvent.setup();

    const WrapperWithRequiredFields = ({
      children,
    }: {
      children: React.ReactNode;
    }) => {
      const formDefaultValues = {
        ...initialValues,
        firstName: "",
        lastName: "",
        birthDate: "",
        caf: "",
        requestedGroups: [
          {
            label: "Test Group",
            value: "test-group",
            specificFields: [
              {
                name: "caf" as const,
                label: "CAF Test",
                errorMessage: "CAF required",
                hintText: "7 digits",
              },
            ],
          },
        ],
      };

      return (
        <RequestFormWrapper defaultValues={formDefaultValues}>
          {children}
        </RequestFormWrapper>
      );
    };

    render(<Step2 />, { wrapper: WrapperWithRequiredFields });

    const firstName = screen.getByLabelText(/Prénom/i);
    const lastName = screen.getByRole("textbox", { name: "Nom" });
    const birthDate = screen.getByLabelText(/Date de naissance/i);
    const phone = screen.getByRole("textbox", {
      name: /Numéro de téléphone/i,
    });
    const cafInput = screen.getByRole("textbox", { name: /Identifiant CAF/i });
    const button = screen.getByRole("button", { name: /Étape 3/i });

    await user.type(firstName, "Jean");
    await user.type(lastName, "Dupont");
    await user.type(birthDate, "2000-01-01");
    await user.type(phone, "0612345678");
    await user.type(cafInput, "1234567"); // Valid format
    await user.click(button);

    expect(mockPush).toHaveBeenCalledWith("/signalement?step=3");
  });

  it("submits successfully when identity field checkbox is checked (null value)", async () => {
    const user = userEvent.setup();

    const WrapperWithRequiredFields = ({
      children,
    }: {
      children: React.ReactNode;
    }) => {
      const formDefaultValues = {
        ...initialValues,
        firstName: "",
        lastName: "",
        birthDate: "",
        nir: "",
        requestedGroups: [
          {
            label: "Test Group",
            value: "test-group",
            specificFields: [
              {
                name: "nir" as const,
                label: "NIR Test",
                errorMessage: "NIR required",
                hintText: "13 ou 15 chiffres",
              },
            ],
          },
        ],
      };

      return (
        <RequestFormWrapper defaultValues={formDefaultValues}>
          {children}
        </RequestFormWrapper>
      );
    };

    render(<Step2 />, { wrapper: WrapperWithRequiredFields });

    const firstName = screen.getByLabelText(/Prénom/i);
    const lastName = screen.getByRole("textbox", { name: "Nom" });
    const birthDate = screen.getByLabelText(/Date de naissance/i);
    const phone = screen.getByRole("textbox", {
      name: /Numéro de téléphone/i,
    });
    const checkbox = screen.getByRole("checkbox", {
      name: "Le citoyen ne peut pas fournir son numéro",
    });
    const button = screen.getByRole("button", { name: /Étape 3/i });

    await user.type(firstName, "Jean");
    await user.type(lastName, "Dupont");
    await user.type(birthDate, "2000-01-01");
    await user.type(phone, "0612345678");
    await user.click(checkbox); // Mark as unable to provide
    await user.click(button);

    expect(mockPush).toHaveBeenCalledWith("/signalement?step=3");
  });

  it("does not render identity fields when not required by requestedGroups", () => {
    render(<Step2 />, { wrapper: RequestFormWrapper });

    expect(
      screen.queryByLabelText("Numéro de sécurité sociale NIR"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Identifiant CAF")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Numéro d'identification fiscale NIF"),
    ).not.toBeInTheDocument();
  });

  it("renders multiple identity fields when required by requestedGroups", () => {
    const WrapperWithMultipleFields = ({
      children,
    }: {
      children: React.ReactNode;
    }) => {
      const formDefaultValues = {
        ...initialValues,
        requestedGroups: [
          {
            label: "Test Group",
            value: "test-group",
            specificFields: [
              {
                name: "nir" as const,
                label: "NIR Test",
                errorMessage: "NIR required",
                hintText: "13 ou 15 chiffres",
              },
              {
                name: "caf" as const,
                label: "CAF Test",
                errorMessage: "CAF required",
                hintText: "7 digits",
              },
            ],
          },
        ],
      };

      return (
        <RequestFormWrapper defaultValues={formDefaultValues}>
          {children}
        </RequestFormWrapper>
      );
    };

    render(<Step2 />, { wrapper: WrapperWithMultipleFields });

    expect(
      screen.getAllByText("Numéro de sécurité sociale NIR")[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText("Identifiant CAF")[0]).toBeInTheDocument();
    expect(
      screen.getByText("Le citoyen ne peut pas fournir son numéro"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Le citoyen ne peut pas fournir son identifiant"),
    ).toBeInTheDocument();
  });

  describe("page structure groups fields by section", () => {
    it("always renders the Identité section with phone and marital name fields", () => {
      render(<Step2 />, { wrapper: RequestFormWrapper });

      expect(
        screen.getByRole("heading", { name: "Identité", level: 3 }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", {
          name: "Informations optionnelles",
          level: 3,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: /Numéro de téléphone/i }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Nom marital/i)).toBeInTheDocument();
    });

    it("hides the operator section when no identity field is required", () => {
      const WrapperWithoutSpecificFields = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <RequestFormWrapper
          defaultValues={{
            ...initialValues,
            requestedTeams: [
              {
                label: "Sans champ spécifique",
                value: "no-specific",
                specificFields: [],
              },
            ],
          }}
        >
          {children}
        </RequestFormWrapper>
      );

      render(<Step2 />, { wrapper: WrapperWithoutSpecificFields });

      expect(
        screen.queryByRole("heading", {
          name: /Informations demandées par le ou les opérateur/i,
        }),
      ).not.toBeInTheDocument();
    });

    it("renders the operator section only when at least one identity field is required", () => {
      const WrapperWithRequiredFields = ({
        children,
      }: {
        children: React.ReactNode;
      }) => {
        const formDefaultValues = {
          ...initialValues,
          requestedGroups: [
            {
              label: "Test Group",
              value: "test-group",
              specificFields: [
                {
                  name: "nir" as const,
                  label: "NIR Test",
                  errorMessage: "NIR required",
                  hintText: "13 ou 15 chiffres",
                },
              ],
            },
          ],
        };

        return (
          <RequestFormWrapper defaultValues={formDefaultValues}>
            {children}
          </RequestFormWrapper>
        );
      };

      render(<Step2 />, { wrapper: WrapperWithRequiredFields });

      expect(
        screen.getByRole("heading", {
          name: /Informations demandées par le ou les opérateur/i,
          level: 3,
        }),
      ).toBeInTheDocument();
    });
  });

  it("resets identity field values to empty string on mount", async () => {
    const WrapperWithPrefilledValues = ({
      children,
    }: {
      children: React.ReactNode;
    }) => {
      const formDefaultValues = {
        ...initialValues,
        nir: undefined, // Pre-filled value
        caf: undefined, // Pre-filled value
        requestedGroups: [
          {
            label: "Test Group",
            value: "test-group",
            specificFields: [
              {
                name: "nir" as const,
                label: "NIR Test",
                errorMessage: "NIR required",
                hintText: "13 ou 15 chiffres",
              },
              {
                name: "caf" as const,
                label: "CAF Test",
                errorMessage: "CAF required",
                hintText: "7 digits",
              },
            ],
          },
        ],
      };

      return (
        <RequestFormWrapper defaultValues={formDefaultValues}>
          {children}
        </RequestFormWrapper>
      );
    };

    render(<Step2 />, { wrapper: WrapperWithPrefilledValues });

    // Wait for useEffect to run and reset values
    await screen.findByRole("textbox", {
      name: /Numéro de sécurité sociale NIR/i,
    });
    await screen.findByRole("textbox", { name: /Identifiant CAF/i });

    // Values should be reset to empty string despite being pre-filled
    const nirInput = screen.getByRole("textbox", {
      name: /Numéro de sécurité sociale NIR/i,
    });
    const cafInput = screen.getByRole("textbox", { name: /Identifiant CAF/i });

    expect(nirInput).toHaveValue("");
    expect(cafInput).toHaveValue("");
  });
});
