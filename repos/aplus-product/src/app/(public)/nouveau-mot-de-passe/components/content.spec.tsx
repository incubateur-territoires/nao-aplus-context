import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import { NewPasswordContent } from "./content";
import { useTRPC } from "@/trpc/client";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
    useMutation: jest.fn(),
  };
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

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

function setupMocks(options?: {
  tokenValidation?: { valid: boolean; error?: string | null };
  isValidating?: boolean;
}) {
  const {
    tokenValidation = { valid: true, error: null },
    isValidating = false,
  } = options || {};

  (useTRPC as jest.Mock).mockReturnValue({
    user: {
      validatePasswordResetToken: {
        queryOptions: () => ({
          queryKey: ["user", "validatePasswordResetToken"],
        }),
      },
      resetPassword: {
        mutationOptions: () => ({
          mutationKey: ["user", "resetPassword"],
        }),
      },
    },
  });

  (useQuery as jest.Mock).mockReturnValue({
    data: tokenValidation,
    isLoading: isValidating,
    error: null,
  });

  (useMutation as jest.Mock).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  });
}

describe("NewPasswordContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("No token provided", () => {
    it("shows error when no token is provided", () => {
      setupMocks();

      render(<NewPasswordContent />, { wrapper: createWrapper() });

      expect(screen.getByText("Lien invalide")).toBeInTheDocument();
      expect(
        screen.getByText(/Aucun token de réinitialisation fourni/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Demander un nouveau lien" }),
      ).toBeInTheDocument();
    });
  });

  describe("Token validation", () => {
    it("shows loading state while validating token", () => {
      setupMocks({ isValidating: true });

      render(<NewPasswordContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("shows error for invalid token", () => {
      setupMocks({
        tokenValidation: { valid: false, error: "TOKEN_INVALID" },
      });

      render(<NewPasswordContent token="invalid-token" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Lien invalide")).toBeInTheDocument();
      expect(
        screen.getByText(/Ce lien de réinitialisation est invalide/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Demander un nouveau lien" }),
      ).toBeInTheDocument();
    });

    it("shows error for expired token", () => {
      setupMocks({
        tokenValidation: { valid: false, error: "TOKEN_EXPIRED" },
      });

      render(<NewPasswordContent token="expired-token" />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByText(/Ce lien de réinitialisation a expiré/i),
      ).toBeInTheDocument();
    });
  });

  describe("Form rendering", () => {
    it("renders the form when token is valid", () => {
      setupMocks({ tokenValidation: { valid: true } });

      render(<NewPasswordContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByRole("heading", {
          name: "Définir un nouveau mot de passe",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Nouveau mot de passe/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Confirmer le mot de passe/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Enregistrer le nouveau mot de passe",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Form validation", () => {
    it("validates password minimum length", async () => {
      const user = userEvent.setup();
      setupMocks({ tokenValidation: { valid: true } });

      render(<NewPasswordContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText(/Nouveau mot de passe/i);
      await user.type(passwordInput, "short");

      const submitButton = screen.getByRole("button", {
        name: "Enregistrer le nouveau mot de passe",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Le mot de passe doit contenir au moins 12 caractères, 1 chiffre et 1 caractère spécial.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("validates password confirmation match", async () => {
      const user = userEvent.setup();
      setupMocks({ tokenValidation: { valid: true } });

      render(<NewPasswordContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText(/Nouveau mot de passe/i);
      const confirmInput = screen.getByLabelText(/Confirmer le mot de passe/i);

      await user.type(passwordInput, "Password123!");
      await user.type(confirmInput, "Different12!");

      const submitButton = screen.getByRole("button", {
        name: "Enregistrer le nouveau mot de passe",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Les mots de passe ne correspondent pas."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form submission", () => {
    it("calls mutation with correct data when form is valid", async () => {
      const user = userEvent.setup();
      setupMocks({ tokenValidation: { valid: true } });

      render(<NewPasswordContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText(/Nouveau mot de passe/i);
      const confirmInput = screen.getByLabelText(/Confirmer le mot de passe/i);

      await user.type(passwordInput, "Password123!");
      await user.type(confirmInput, "Password123!");

      const submitButton = screen.getByRole("button", {
        name: "Enregistrer le nouveau mot de passe",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          token: "valid-token",
          password: "Password123!",
          passwordConfirmation: "Password123!",
        });
      });
    });
  });

  describe("Success state", () => {
    it("shows success message after successful submission", async () => {
      const user = userEvent.setup();
      let capturedOnSuccess: (() => void) | undefined;

      (useTRPC as jest.Mock).mockReturnValue({
        user: {
          validatePasswordResetToken: {
            queryOptions: () => ({
              queryKey: ["user", "validatePasswordResetToken"],
            }),
          },
          resetPassword: {
            mutationOptions: (callbacks?: { onSuccess?: () => void }) => {
              capturedOnSuccess = callbacks?.onSuccess;
              return {
                mutationKey: ["user", "resetPassword"],
              };
            },
          },
        },
      });

      (useQuery as jest.Mock).mockReturnValue({
        data: { valid: true },
        isLoading: false,
        error: null,
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

      render(<NewPasswordContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText(/Nouveau mot de passe/i);
      const confirmInput = screen.getByLabelText(/Confirmer le mot de passe/i);

      await user.type(passwordInput, "Password123!");
      await user.type(confirmInput, "Password123!");

      const submitButton = screen.getByRole("button", {
        name: "Enregistrer le nouveau mot de passe",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Mot de passe modifié")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Votre mot de passe a été modifié avec succès/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Se connecter" }),
      ).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("shows error message when mutation fails", async () => {
      const user = userEvent.setup();
      let capturedOnError: ((err: Error) => void) | undefined;

      (useTRPC as jest.Mock).mockReturnValue({
        user: {
          validatePasswordResetToken: {
            queryOptions: () => ({
              queryKey: ["user", "validatePasswordResetToken"],
            }),
          },
          resetPassword: {
            mutationOptions: (callbacks?: {
              onError?: (err: Error) => void;
            }) => {
              capturedOnError = callbacks?.onError;
              return {
                mutationKey: ["user", "resetPassword"],
              };
            },
          },
        },
      });

      (useQuery as jest.Mock).mockReturnValue({
        data: { valid: true },
        isLoading: false,
        error: null,
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

      render(<NewPasswordContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText(/Nouveau mot de passe/i);
      const confirmInput = screen.getByLabelText(/Confirmer le mot de passe/i);

      await user.type(passwordInput, "Password123!");
      await user.type(confirmInput, "Password123!");

      const submitButton = screen.getByRole("button", {
        name: "Enregistrer le nouveau mot de passe",
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Erreur serveur")).toBeInTheDocument();
      });
    });
  });
});
