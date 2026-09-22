import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { ResetPasswordForm } from "./reset-password";
import { useTRPC } from "@/trpc/client";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useMutation: jest.fn(),
  };
});

const mockMutate = jest.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function setupMocks() {
  (useTRPC as jest.Mock).mockReturnValue({
    user: {
      requestPasswordReset: {
        mutationOptions: () => ({
          mutationKey: ["user", "requestPasswordReset"],
        }),
      },
    },
  });

  (useMutation as jest.Mock).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  });
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Initial render", () => {
    it("renders the form with email input", () => {
      setupMocks();

      render(<ResetPasswordForm />, { wrapper: createWrapper() });

      expect(
        screen.getByRole("heading", { name: "Mot de passe oublié" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Réinitialiser le mot de passe" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Adresse e-mail/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /Envoyer l.e-mail de réinitialisation/,
        }),
      ).toBeInTheDocument();
    });

    it("shows description text", () => {
      setupMocks();

      render(<ResetPasswordForm />, { wrapper: createWrapper() });

      expect(
        screen.getByText(/Saisissez votre adresse e-mail/i),
      ).toBeInTheDocument();
    });
  });

  describe("Form submission", () => {
    it("calls mutation with email when form is submitted", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<ResetPasswordForm />, { wrapper: createWrapper() });

      const emailInput = screen.getByLabelText(/Adresse e-mail/i);
      await user.type(emailInput, "test@example.com");

      const submitButton = screen.getByRole("button", {
        name: /Envoyer l.e-mail de réinitialisation/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({ email: "test@example.com" });
      });
    });

    it("does not submit when email is empty", async () => {
      const user = userEvent.setup();
      setupMocks();

      render(<ResetPasswordForm />, { wrapper: createWrapper() });

      const submitButton = screen.getByRole("button", {
        name: /Envoyer l.e-mail de réinitialisation/,
      });
      await user.click(submitButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe("Success state", () => {
    it("shows success message after successful submission", async () => {
      const user = userEvent.setup();
      let capturedOnSuccess: (() => void) | undefined;

      (useTRPC as jest.Mock).mockReturnValue({
        user: {
          requestPasswordReset: {
            mutationOptions: (callbacks?: { onSuccess?: () => void }) => {
              capturedOnSuccess = callbacks?.onSuccess;
              return {
                mutationKey: ["user", "requestPasswordReset"],
              };
            },
          },
        },
      });

      (useMutation as jest.Mock).mockImplementation(() => {
        return {
          mutate: () => {
            if (capturedOnSuccess) {
              capturedOnSuccess();
            }
          },
          isPending: false,
          isError: false,
          error: null,
        };
      });

      render(<ResetPasswordForm />, { wrapper: createWrapper() });

      const emailInput = screen.getByLabelText(/Adresse e-mail/i);
      await user.type(emailInput, "test@example.com");

      const submitButton = screen.getByRole("button", {
        name: /Envoyer l.e-mail de réinitialisation/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Si un compte est associé à cette adresse/i),
        ).toBeInTheDocument();
      });
    });

    it("shows spam reminder after success", async () => {
      const user = userEvent.setup();
      let capturedOnSuccess: (() => void) | undefined;

      (useTRPC as jest.Mock).mockReturnValue({
        user: {
          requestPasswordReset: {
            mutationOptions: (callbacks?: { onSuccess?: () => void }) => {
              capturedOnSuccess = callbacks?.onSuccess;
              return {
                mutationKey: ["user", "requestPasswordReset"],
              };
            },
          },
        },
      });

      (useMutation as jest.Mock).mockImplementation(() => {
        return {
          mutate: () => {
            if (capturedOnSuccess) {
              capturedOnSuccess();
            }
          },
          isPending: false,
          isError: false,
          error: null,
        };
      });

      render(<ResetPasswordForm />, { wrapper: createWrapper() });

      const emailInput = screen.getByLabelText(/Adresse e-mail/i);
      await user.type(emailInput, "test@example.com");

      const submitButton = screen.getByRole("button", {
        name: /Envoyer l.e-mail de réinitialisation/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Pensez à vérifier vos spams/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error state", () => {
    it("shows error message when mutation fails", async () => {
      const user = userEvent.setup();
      let capturedOnError: ((err: Error) => void) | undefined;

      (useTRPC as jest.Mock).mockReturnValue({
        user: {
          requestPasswordReset: {
            mutationOptions: (callbacks?: {
              onError?: (err: Error) => void;
            }) => {
              capturedOnError = callbacks?.onError;
              return {
                mutationKey: ["user", "requestPasswordReset"],
              };
            },
          },
        },
      });

      (useMutation as jest.Mock).mockImplementation(() => {
        return {
          mutate: () => {
            if (capturedOnError) {
              capturedOnError(new Error("Erreur serveur"));
            }
          },
          isPending: false,
          isError: false,
          error: null,
        };
      });

      render(<ResetPasswordForm />, { wrapper: createWrapper() });

      const emailInput = screen.getByLabelText(/Adresse e-mail/i);
      await user.type(emailInput, "test@example.com");

      const submitButton = screen.getByRole("button", {
        name: /Envoyer l.e-mail de réinitialisation/,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Erreur serveur")).toBeInTheDocument();
      });
    });
  });
});
