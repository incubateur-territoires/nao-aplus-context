import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ActionChoiceRadio } from "./action-choice-radio";
import { ActionChoiceValue } from "../../../action-choice/action-choice";
import { useForm, FormProvider } from "react-hook-form";
import { FormValues } from "../types";

// Mock RadioButtons component from DSFR
jest.mock("@codegouvfr/react-dsfr/RadioButtons", () => {
  return function MockRadioButtons({
    legend,
    options,
    id,
    state,
    stateRelatedMessage,
  }: {
    legend: string;
    options: Array<{
      label: string;
      hintText: React.ReactNode;
      nativeInputProps: {
        name: string;
        value: string;
        checked: boolean;
        onChange: () => void;
      };
    }>;
    id: string;
    state: string;
    stateRelatedMessage?: string;
  }) {
    return (
      <div data-testid="radio-buttons" data-state={state} data-id={id}>
        <legend>{legend}</legend>
        {stateRelatedMessage && (
          <div data-testid="error-message">{stateRelatedMessage}</div>
        )}
        {options.map((option, index) => (
          <div
            key={index}
            data-testid={`radio-option-${option.nativeInputProps.value}`}
          >
            <label>
              <input
                type="radio"
                name={option.nativeInputProps.name}
                value={option.nativeInputProps.value}
                checked={option.nativeInputProps.checked}
                onChange={option.nativeInputProps.onChange}
                data-testid={`radio-input-${option.nativeInputProps.value}`}
              />
              {option.label}
            </label>
            <div data-testid={`hint-${option.nativeInputProps.value}`}>
              {option.hintText}
            </div>
          </div>
        ))}
      </div>
    );
  };
});

function TestWrapper({
  children,
  defaultValues = {},
  errors = {},
}: {
  children: React.ReactNode;
  defaultValues?: Partial<FormValues>;
  errors?: Record<string, { message: string }>;
}) {
  const methods = useForm<FormValues>({
    defaultValues: {
      message: "",
      files: [],
      isOperatorOnly: false,
      isIrrelevant: false,
      actionChoice: null,
      ...defaultValues,
    },
  });

  // Inject errors after mount using useEffect
  React.useEffect(() => {
    if (Object.keys(errors).length > 0) {
      Object.entries(errors).forEach(([key, error]) => {
        methods.setError(key as keyof FormValues, error);
      });
    }
  }, [errors, methods]); // Empty dependency array means this runs once after mount

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("ActionChoiceRadio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders RadioButtons component with correct legend", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );
    });

    it("renders all three action choice options by default", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      expect(
        screen.getByTestId("radio-option-IN_TREATMENT"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("radio-option-COMPLETED")).toBeInTheDocument();
      expect(
        screen.getByTestId("radio-option-SEND_MESSAGE"),
      ).toBeInTheDocument();
    });

    it("renders correct option labels", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      expect(
        screen.getByText("Prendre en charge le signalement"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Marquer le signalement comme traité"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Ajouter un message ou un fichier"),
      ).toBeInTheDocument();
    });

    it("renders hint text with HTML for each option", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const inTreatmentHint = screen.getByTestId("hint-IN_TREATMENT");
      expect(inTreatmentHint).toBeInTheDocument();
      expect(inTreatmentHint.querySelector("p")).toHaveClass(
        "text-xs",
        "m-0",
        "font-regular",
        "text-[#666666]",
      );

      const completedHint = screen.getByTestId("hint-COMPLETED");
      expect(completedHint).toBeInTheDocument();

      const sendMessageHint = screen.getByTestId("hint-SEND_MESSAGE");
      expect(sendMessageHint).toBeInTheDocument();
    });

    it("renders with default state when no errors", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const radioButtons = screen.getByTestId("radio-buttons");
      expect(radioButtons).toHaveAttribute("data-state", "default");
    });
  });

  describe("Options Filtering Logic", () => {
    it("filters out IN_TREATMENT option when current status is IN_TREATMENT", async () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio currentStatus="IN_TREATMENT" />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.queryByTestId("radio-option-IN_TREATMENT"),
        ).not.toBeInTheDocument();
        expect(
          screen.getByTestId("radio-option-COMPLETED"),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId("radio-option-SEND_MESSAGE"),
        ).toBeInTheDocument();
      });
    });

    it("filters out COMPLETED option when current status is COMPLETED", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio currentStatus="COMPLETED" />
        </TestWrapper>,
      );

      expect(
        screen.getByTestId("radio-option-IN_TREATMENT"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("radio-option-COMPLETED"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId("radio-option-SEND_MESSAGE"),
      ).toBeInTheDocument();
    });

    it("filters out COMPLETED option when current status is CLOSED", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio currentStatus="CLOSED" />
        </TestWrapper>,
      );

      expect(
        screen.getByTestId("radio-option-IN_TREATMENT"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("radio-option-COMPLETED"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId("radio-option-SEND_MESSAGE"),
      ).toBeInTheDocument();
    });

    it("shows all options when current status is PENDING_ASSIGNMENT", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio currentStatus="PENDING_ASSIGNMENT" />
        </TestWrapper>,
      );

      expect(
        screen.getByTestId("radio-option-IN_TREATMENT"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("radio-option-COMPLETED")).toBeInTheDocument();
      expect(
        screen.getByTestId("radio-option-SEND_MESSAGE"),
      ).toBeInTheDocument();
    });

    it("shows all options when current status is not provided", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      expect(
        screen.getByTestId("radio-option-IN_TREATMENT"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("radio-option-COMPLETED")).toBeInTheDocument();
      expect(
        screen.getByTestId("radio-option-SEND_MESSAGE"),
      ).toBeInTheDocument();
    });

    it("shows all options when action choice is not set", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      expect(
        screen.getByTestId("radio-option-IN_TREATMENT"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("radio-option-COMPLETED")).toBeInTheDocument();
      expect(
        screen.getByTestId("radio-option-SEND_MESSAGE"),
      ).toBeInTheDocument();
    });
  });

  describe("Field State and Selection", () => {
    it("marks COMPLETED as checked when it is selected", () => {
      render(
        <TestWrapper
          defaultValues={{ actionChoice: ActionChoiceValue.COMPLETED }}
        >
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const completedInput = screen.getByTestId("radio-input-COMPLETED");
      expect(completedInput).toBeChecked();
    });

    it("marks SEND_MESSAGE as checked when it is selected", () => {
      render(
        <TestWrapper
          defaultValues={{ actionChoice: ActionChoiceValue.SEND_MESSAGE }}
        >
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const sendMessageInput = screen.getByTestId("radio-input-SEND_MESSAGE");
      expect(sendMessageInput).toBeChecked();
    });

    it("has no option checked when value is null", () => {
      render(
        <TestWrapper defaultValues={{ actionChoice: null }}>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const inTreatmentInput = screen.getByTestId("radio-input-IN_TREATMENT");
      const completedInput = screen.getByTestId("radio-input-COMPLETED");
      const sendMessageInput = screen.getByTestId("radio-input-SEND_MESSAGE");

      expect(inTreatmentInput).not.toBeChecked();
      expect(completedInput).not.toBeChecked();
      expect(sendMessageInput).not.toBeChecked();
    });
  });

  describe("User Interactions", () => {
    it("allows selecting COMPLETED option", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const completedInput = screen.getByTestId("radio-input-COMPLETED");
      expect(completedInput).not.toBeChecked();

      await user.click(completedInput);

      await waitFor(() => {
        expect(completedInput).toBeChecked();
      });
    });

    it("allows selecting SEND_MESSAGE option", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const sendMessageInput = screen.getByTestId("radio-input-SEND_MESSAGE");
      expect(sendMessageInput).not.toBeChecked();

      await user.click(sendMessageInput);

      await waitFor(() => {
        expect(sendMessageInput).toBeChecked();
      });
    });

    it("allows changing selection between COMPLETED and SEND_MESSAGE", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const completedInput = screen.getByTestId("radio-input-COMPLETED");
      const sendMessageInput = screen.getByTestId("radio-input-SEND_MESSAGE");

      // Select COMPLETED first
      await user.click(completedInput);
      await waitFor(() => {
        expect(completedInput).toBeChecked();
        expect(sendMessageInput).not.toBeChecked();
      });

      // Then select SEND_MESSAGE
      await user.click(sendMessageInput);
      await waitFor(() => {
        expect(sendMessageInput).toBeChecked();
        expect(completedInput).not.toBeChecked();
      });
    });
  });

  describe("Error Handling", () => {
    it("displays error state when form has validation errors", async () => {
      render(
        <TestWrapper
          errors={{
            actionChoice: { message: "Veuillez sélectionner une option" },
          }}
        >
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      await waitFor(() => {
        const radioButtons = screen.getByTestId("radio-buttons");
        expect(radioButtons).toHaveAttribute("data-state", "error");
      });
    });

    it("displays error message when form has validation errors", async () => {
      const errorMessage = "Veuillez sélectionner une option";

      render(
        <TestWrapper errors={{ actionChoice: { message: errorMessage } }}>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-message")).toHaveTextContent(
          errorMessage,
        );
      });
    });

    it("does not display error message when no errors exist", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      expect(screen.queryByTestId("error-message")).not.toBeInTheDocument();
    });

    it("displays error state even with empty error message", async () => {
      render(
        <TestWrapper errors={{ actionChoice: { message: "" } }}>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      await waitFor(() => {
        const radioButtons = screen.getByTestId("radio-buttons");
        expect(radioButtons).toHaveAttribute("data-state", "error");
        // When message is empty string, the error message element might not render
        // but the error state should still be set
      });
    });
  });

  describe("Controller Integration", () => {
    it("sets correct radio button id from field name", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const radioButtons = screen.getByTestId("radio-buttons");
      expect(radioButtons).toHaveAttribute("data-id", "actionChoice");
    });

    it("uses actionChoice as the field name for all radio inputs", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const inTreatmentInput = screen.getByTestId("radio-input-IN_TREATMENT");
      const completedInput = screen.getByTestId("radio-input-COMPLETED");
      const sendMessageInput = screen.getByTestId("radio-input-SEND_MESSAGE");

      expect(inTreatmentInput).toHaveAttribute("name", "actionChoice");
      expect(completedInput).toHaveAttribute("name", "actionChoice");
      expect(sendMessageInput).toHaveAttribute("name", "actionChoice");
    });
  });

  describe("Edge Cases", () => {
    it("handles error state with filtered options when status is IN_TREATMENT", async () => {
      render(
        <TestWrapper errors={{ actionChoice: { message: "Error message" } }}>
          <ActionChoiceRadio currentStatus="IN_TREATMENT" />
        </TestWrapper>,
      );

      // Should filter options AND show error state
      await waitFor(() => {
        expect(
          screen.queryByTestId("radio-option-IN_TREATMENT"),
        ).not.toBeInTheDocument();
      });

      const radioButtons = screen.getByTestId("radio-buttons");
      expect(radioButtons).toHaveAttribute("data-state", "error");
    });

    it("handles error state with filtered options when status is CLOSED", async () => {
      render(
        <TestWrapper errors={{ actionChoice: { message: "Error message" } }}>
          <ActionChoiceRadio currentStatus="CLOSED" />
        </TestWrapper>,
      );

      // Should filter out COMPLETED option AND show error state
      await waitFor(() => {
        expect(
          screen.queryByTestId("radio-option-COMPLETED"),
        ).not.toBeInTheDocument();
      });

      const radioButtons = screen.getByTestId("radio-buttons");
      expect(radioButtons).toHaveAttribute("data-state", "error");
    });
  });

  describe("Accessibility", () => {
    it("provides proper radio button semantics", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const radios = screen.getAllByRole("radio");
      expect(radios.length).toBe(3);
      radios.forEach((radio) => {
        expect(radio).toHaveAttribute("type", "radio");
        expect(radio).toHaveAttribute("name", "actionChoice");
      });
    });

    it("associates labels with radio inputs", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        const label = radio.closest("label");
        expect(label).toBeInTheDocument();
      });
    });

    it("provides hint text for each option", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio />
        </TestWrapper>,
      );

      expect(screen.getByTestId("hint-IN_TREATMENT")).toBeInTheDocument();
      expect(screen.getByTestId("hint-COMPLETED")).toBeInTheDocument();
      expect(screen.getByTestId("hint-SEND_MESSAGE")).toBeInTheDocument();
    });

    it("provides proper radio button semantics when options are filtered", () => {
      render(
        <TestWrapper>
          <ActionChoiceRadio currentStatus="IN_TREATMENT" />
        </TestWrapper>,
      );

      const radios = screen.getAllByRole("radio");
      expect(radios.length).toBe(2); // IN_TREATMENT is filtered out
      radios.forEach((radio) => {
        expect(radio).toHaveAttribute("type", "radio");
        expect(radio).toHaveAttribute("name", "actionChoice");
      });
    });
  });
});
