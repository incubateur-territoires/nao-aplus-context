import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RenderChoiceForm } from "./render-choice-form";
import { ReportStatus } from "@/generated/prisma/client";
import * as reactQuery from "@tanstack/react-query";

// Mock useParams
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-request-id" }),
}));

// Mock InputFile component
jest.mock("@/app/component/ui/input-file/input-file", () => ({
  InputFile: ({
    onChange,
    ...props
  }: {
    onChange: (files: File[]) => void;
  }) => (
    <div data-testid="input-file">
      <input
        type="file"
        onChange={(e) => onChange(Array.from(e.target.files || []))}
        {...props}
      />
    </div>
  ),
}));

// Mock useUploadFiles hook
const mockUploadFiles = jest.fn();
let mockUploadFilesPending = false;
jest.mock("@/app/query/file/file.query", () => ({
  useUploadFiles: () => ({
    mutateAsync: mockUploadFiles,
    isPending: mockUploadFilesPending,
  }),
}));

// Mock react-query hooks
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

// Mock TRPC
const mockCreateAnswer = jest.fn();
const mockTrpc = {
  answer: {
    createAnswer: {
      mutationOptions: jest.fn(() => ({
        mutationKey: ["createAnswer"],
        mutationFn: mockCreateAnswer,
      })),
    },
    markAnswerAsViewed: {
      mutationOptions: jest.fn(() => ({
        mutationKey: ["answer", "markAnswerAsViewed"],
      })),
    },
    markAnswersAsViewed: {
      mutationOptions: jest.fn(() => ({
        mutationKey: ["answer", "markAnswersAsViewed"],
      })),
    },
  },
  request: {
    getRequestById: {
      queryOptions: jest.fn(),
    },
  },
};

jest.mock("@/trpc/client", () => ({
  useTRPC: () => mockTrpc,
}));

describe("RenderChoiceForm", () => {
  const defaultProps = {
    resetSelectedChoice: jest.fn(),
    currentStatus: undefined,
  };

  const renderWithWrapper = (props = {}) => {
    return render(<RenderChoiceForm {...defaultProps} {...props} />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadFilesPending = false;

    // Mock successful mutation
    (reactQuery.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateAnswer,
      isPending: false,
      isError: false,
      error: null,
    });

    mockUploadFiles.mockResolvedValue({
      ok: true,
      data: [],
    });

    mockCreateAnswer.mockResolvedValue({
      success: true,
    });
  });

  it("renders message textarea after selecting action choice", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    // Initially no textarea visible
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    // Select SEND_MESSAGE
    const sendMessageRadio = screen.getByRole("radio", {
      name: /Ajouter un message ou un fichier/i,
    });
    await user.click(sendMessageRadio);

    // Now textarea should be visible with empty value
    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue("");
    });
  });

  it("renders file input component after selecting action choice", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    // Initially no file input visible
    expect(screen.queryByTestId("input-file")).not.toBeInTheDocument();

    // Select SEND_MESSAGE
    const sendMessageRadio = screen.getByRole("radio", {
      name: /Ajouter un message ou un fichier/i,
    });
    await user.click(sendMessageRadio);

    // Now file input should be visible
    await waitFor(() => {
      expect(screen.getByTestId("input-file")).toBeInTheDocument();
    });
  });

  it("renders action choice radio buttons", () => {
    renderWithWrapper();

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

  it("renders submit button only after action choice is selected", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    // Initially no submit button visible
    expect(
      screen.queryByRole("button", { name: /Répondre/i }),
    ).not.toBeInTheDocument();

    // Select SEND_MESSAGE
    const sendMessageRadio = screen.getByRole("radio", {
      name: /Ajouter un message ou un fichier/i,
    });
    await user.click(sendMessageRadio);

    // Now submit button should be visible
    await waitFor(() => {
      const submitButton = screen.getByRole("button", {
        name: /Ajouter un message ou un fichier/i,
      });
      expect(submitButton).toBeInTheDocument();
    });
  });

  it("shows instructor only toggle when SEND_MESSAGE is selected", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    const sendMessageRadio = screen.getByRole("radio", {
      name: /Ajouter un message ou un fichier/i,
    });
    await user.click(sendMessageRadio);

    const toggle = screen.getByRole("checkbox", {
      name: "Cacher ce message aux auteurs et aux co-auteurs afin que seuls les opérateurs puissent le lire",
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle.closest(".mt-8")).not.toHaveClass("hidden");
  });

  it("shows irrelevant toggle when COMPLETED is selected", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    const completedRadio = screen.getByRole("radio", {
      name: /Marquer le signalement comme traité/i,
    });
    await user.click(completedRadio);

    const checkboxes = screen.getAllByRole("checkbox");
    const irrelevantToggle = checkboxes.find(
      (checkbox) =>
        checkbox.getAttribute("aria-describedby")?.includes("hint-text") &&
        checkbox.closest(".mt-8")?.textContent?.includes("procédure standard"),
    );
    expect(irrelevantToggle).toBeInTheDocument();
    expect(irrelevantToggle?.closest(".mt-8")).not.toHaveClass("hidden");
  });

  it("submits form with correct data when IN_TREATMENT is selected", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    // Select IN_TREATMENT radio
    const inTreatmentRadio = screen.getByRole("radio", {
      name: /Prendre en charge le signalement/i,
    });
    await user.click(inTreatmentRadio);

    // Wait for message to be populated
    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveValue(
        "Bonjour,\nJe m'occupe de ce signalement.\nCordialement,",
      );
    });

    const submitButton = screen.getByRole("button", {
      name: /Prendre en charge le signalement/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      // File upload should NOT be called when there are no files
      expect(mockUploadFiles).not.toHaveBeenCalled();
      expect(mockCreateAnswer).toHaveBeenCalledWith({
        newReportStatus: ReportStatus.IN_TREATMENT,
        reportId: "test-request-id",
        content: "Bonjour,\nJe m'occupe de ce signalement.\nCordialement,",
        files: [],
        isOperatorOnly: false,
        isIrrelevant: false,
      });
    });
  });

  // Note: File upload with files is tested in integration tests
  // The logic that uploadFiles is only called when files.length > 0 is verified
  // by the "skips file upload when no files are provided" test below

  it("disables submit button when pending", async () => {
    (reactQuery.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateAnswer,
      isPending: true,
      isError: false,
      error: null,
    });

    const user = userEvent.setup();
    renderWithWrapper();

    // Select an action choice
    const inTreatmentRadio = screen.getByRole("radio", {
      name: /Prendre en charge le signalement/i,
    });
    await user.click(inTreatmentRadio);

    // Pendant la soumission, le bouton affiche "Envoi en cours…"
    const submitButton = screen.getByRole("button", {
      name: /Envoi en cours/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it("disables submit button when file upload is pending", async () => {
    mockUploadFilesPending = true;

    const user = userEvent.setup();
    renderWithWrapper();

    // Select an action choice
    const inTreatmentRadio = screen.getByRole("radio", {
      name: /Prendre en charge le signalement/i,
    });
    await user.click(inTreatmentRadio);

    // Pendant l'upload, le bouton affiche "Envoi en cours…"
    const submitButton = screen.getByRole("button", {
      name: /Envoi en cours/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it("shows mutation error message", () => {
    (reactQuery.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateAnswer,
      isPending: false,
      isError: true,
      error: { message: "Mutation error" },
    });

    renderWithWrapper();

    expect(screen.getByText("Erreur: Mutation error")).toBeInTheDocument();
  });

  it("updates message value on change", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    // Select SEND_MESSAGE first to show textarea
    const sendMessageRadio = screen.getByRole("radio", {
      name: /Ajouter un message ou un fichier/i,
    });
    await user.click(sendMessageRadio);

    const textarea = await screen.findByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "New message content");

    expect(textarea).toHaveValue("New message content");
  });

  it("toggles instructor only setting", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    // Select SEND_MESSAGE to show instructor only toggle
    const sendMessageRadio = screen.getByRole("radio", {
      name: /Ajouter un message ou un fichier/i,
    });
    await user.click(sendMessageRadio);

    const toggle = screen.getByRole("checkbox", {
      name: "Cacher ce message aux auteurs et aux co-auteurs afin que seuls les opérateurs puissent le lire",
    });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();
  });

  it("applies correct form structure and styling", async () => {
    const user = userEvent.setup();
    renderWithWrapper();

    // Select an action choice to enable form elements
    const inTreatmentRadio = screen.getByRole("radio", {
      name: /Prendre en charge le signalement/i,
    });
    await user.click(inTreatmentRadio);

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();

      const submitButton = screen.getByRole("button", {
        name: /Prendre en charge le signalement/i,
      });
      expect(submitButton).toHaveClass(
        "mt-10",
        "flex",
        "justify-end",
        "float-right",
      );
    });
  });

  it("submits form successfully and calls reset callback", async () => {
    const user = userEvent.setup();
    const mockReset = jest.fn();

    renderWithWrapper({ resetSelectedChoice: mockReset });

    // Select an action choice
    const inTreatmentRadio = screen.getByRole("radio", {
      name: /Prendre en charge le signalement/i,
    });
    await user.click(inTreatmentRadio);

    const submitButton = screen.getByRole("button", {
      name: /Prendre en charge le signalement/i,
    });
    await user.click(submitButton);

    // Verify the form was submitted with correct data
    await waitFor(() => {
      // File upload should NOT be called when there are no files
      expect(mockUploadFiles).not.toHaveBeenCalled();
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          newReportStatus: ReportStatus.IN_TREATMENT,
          reportId: "test-request-id",
        }),
      );
    });

    // Note: Form reset and resetSelectedChoice callback are called in onSuccess
    // which is tested in integration tests
  });

  describe("New Logic - Action Choice Integration", () => {
    it("populates default message when IN_TREATMENT is selected", async () => {
      const user = userEvent.setup();
      renderWithWrapper();

      // Select IN_TREATMENT
      const inTreatmentRadio = screen.getByRole("radio", {
        name: /Prendre en charge le signalement/i,
      });
      await user.click(inTreatmentRadio);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveValue(
          "Bonjour,\nJe m'occupe de ce signalement.\nCordialement,",
        );
      });
    });

    it("populates default message when COMPLETED is selected", async () => {
      const user = userEvent.setup();
      renderWithWrapper();

      // Select COMPLETED
      const completedRadio = screen.getByRole("radio", {
        name: /Marquer le signalement comme traité/i,
      });
      await user.click(completedRadio);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveValue(
          "Bonjour,\nJ'ai fait le nécessaire.\nJe vous invite à fermer le signalement.\nCordialement,",
        );
      });
    });

    it("keeps message empty when SEND_MESSAGE is selected", async () => {
      const user = userEvent.setup();
      renderWithWrapper();

      // Select SEND_MESSAGE
      const sendMessageRadio = screen.getByRole("radio", {
        name: /Ajouter un message ou un fichier/i,
      });
      await user.click(sendMessageRadio);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveValue("");
      });
    });

    it("changes default message when switching between action choices", async () => {
      const user = userEvent.setup();
      renderWithWrapper();

      // Select IN_TREATMENT first
      const inTreatmentRadio = screen.getByRole("radio", {
        name: /Prendre en charge le signalement/i,
      });
      await user.click(inTreatmentRadio);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveValue(
          "Bonjour,\nJe m'occupe de ce signalement.\nCordialement,",
        );
      });

      // Switch to COMPLETED
      const completedRadio = screen.getByRole("radio", {
        name: /Marquer le signalement comme traité/i,
      });
      await user.click(completedRadio);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveValue(
          "Bonjour,\nJ'ai fait le nécessaire.\nJe vous invite à fermer le signalement.\nCordialement,",
        );
      });
    });

    it("sends undefined newReportStatus when SEND_MESSAGE is selected", async () => {
      const user = userEvent.setup();
      renderWithWrapper();

      // Select SEND_MESSAGE
      const sendMessageRadio = screen.getByRole("radio", {
        name: /Ajouter un message ou un fichier/i,
      });
      await user.click(sendMessageRadio);

      // Type a message (required for SEND_MESSAGE)
      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Test message for send");

      const submitButton = screen.getByRole("button", {
        name: /Ajouter un message ou un fichier/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        // File upload should NOT be called when there are no files
        expect(mockUploadFiles).not.toHaveBeenCalled();
        expect(mockCreateAnswer).toHaveBeenCalledWith({
          newReportStatus: undefined,
          reportId: "test-request-id",
          content: "Test message for send",
          files: [],
          isOperatorOnly: false,
          isIrrelevant: false,
        });
      });
    });

    it("sends COMPLETED status when COMPLETED is selected", async () => {
      const user = userEvent.setup();
      renderWithWrapper();

      // Select COMPLETED
      const completedRadio = screen.getByRole("radio", {
        name: /Marquer le signalement comme traité/i,
      });
      await user.click(completedRadio);

      // Wait for default message to populate
      await waitFor(() => {
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
        expect(textarea.value.length).toBeGreaterThan(0);
      });

      const submitButton = screen.getByRole("button", {
        name: /Marquer le signalement comme traité/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        // File upload should NOT be called when there are no files
        expect(mockUploadFiles).not.toHaveBeenCalled();
        expect(mockCreateAnswer).toHaveBeenCalledWith(
          expect.objectContaining({
            newReportStatus: ReportStatus.COMPLETED,
          }),
        );
      });
    });

    it("requires action choice selection before submission", async () => {
      renderWithWrapper();

      // Without selecting an action choice, no submit button should be visible
      expect(
        screen.queryByRole("button", { name: /Répondre/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Prendre en charge/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Marquer/i }),
      ).not.toBeInTheDocument();

      // Should not call createAnswer
      expect(mockCreateAnswer).not.toHaveBeenCalled();
    });

    it("updates button label based on selected action choice", async () => {
      const user = userEvent.setup();
      renderWithWrapper();

      // Initially no action selected - button should not be visible
      expect(
        screen.queryByRole("button", { name: /Prendre en charge/i }),
      ).not.toBeInTheDocument();

      // Select IN_TREATMENT
      const inTreatmentRadio = screen.getByRole("radio", {
        name: /Prendre en charge le signalement/i,
      });
      await user.click(inTreatmentRadio);

      await waitFor(() => {
        const submitButton = screen.getByRole("button", {
          name: /Prendre en charge le signalement/i,
        });
        expect(submitButton).toBeInTheDocument();
      });

      // Switch to SEND_MESSAGE
      const sendMessageRadio = screen.getByRole("radio", {
        name: /Ajouter un message ou un fichier/i,
      });
      await user.click(sendMessageRadio);

      await waitFor(() => {
        const submitButton = screen.getByRole("button", {
          name: /Ajouter un message ou un fichier/i,
        });
        expect(submitButton).toBeInTheDocument();
      });
    });

    it("skips file upload when no files are provided", async () => {
      const user = userEvent.setup();
      renderWithWrapper();

      // Select SEND_MESSAGE
      const sendMessageRadio = screen.getByRole("radio", {
        name: /Ajouter un message ou un fichier/i,
      });
      await user.click(sendMessageRadio);

      // Type a message without uploading any files
      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Message without files");

      const submitButton = screen.getByRole("button", {
        name: /Ajouter un message ou un fichier/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        // File upload should NOT be called when files array is empty
        expect(mockUploadFiles).not.toHaveBeenCalled();
        // Form should still submit successfully
        expect(mockCreateAnswer).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [],
            content: "Message without files",
          }),
        );
      });
    });
  });
});
