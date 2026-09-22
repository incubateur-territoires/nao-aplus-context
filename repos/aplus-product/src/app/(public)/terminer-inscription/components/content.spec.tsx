import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import { FinishRegistrationContent } from "./content";
import { useTRPC } from "@/trpc/client";
import { signIn } from "@/lib/auth-client";

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

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/terminer-inscription",
}));

jest.mock("@/lib/auth-client", () => ({
  signIn: {
    email: jest.fn(),
  },
}));

const mockPendingUser = {
  id: "pending-user-1",
  email: "test@example.com",
  firstName: "John",
  lastName: "Doe",
};

const mockCompleteRegistration = jest.fn();

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

function setupMocks(options: {
  tokenValidation?: {
    valid: boolean;
    error?: string | null;
    pendingUser?: typeof mockPendingUser | null;
  };
  isValidating?: boolean;
  tokenError?: Error | null;
}) {
  const {
    tokenValidation = { valid: true, pendingUser: mockPendingUser },
    isValidating = false,
    tokenError = null,
  } = options;

  (useTRPC as jest.Mock).mockReturnValue({
    user: {
      validateToken: {
        queryOptions: () => ({
          queryKey: ["user", "validateToken"],
          queryFn: async () => tokenValidation,
        }),
      },
      completeRegistration: {
        mutationOptions: () => ({
          mutationKey: ["user", "completeRegistration"],
          mutationFn: mockCompleteRegistration,
        }),
      },
    },
  });

  (useQuery as jest.Mock).mockReturnValue({
    data: tokenValidation,
    isLoading: isValidating,
    error: tokenError,
  });

  (useMutation as jest.Mock).mockReturnValue({
    mutateAsync: mockCompleteRegistration,
    isPending: false,
    error: null,
  });
}

describe("FinishRegistrationContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Token validation", () => {
    it("shows error when no token is provided", () => {
      setupMocks({ tokenValidation: { valid: false } });

      render(<FinishRegistrationContent />, { wrapper: createWrapper() });

      expect(screen.getByText("Lien invalide")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Le lien d'invitation est invalide. Veuillez vérifier le lien reçu par email ou contacter votre administrateur.",
        ),
      ).toBeInTheDocument();
    });

    it("shows loading spinner while validating token", () => {
      setupMocks({ isValidating: true });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("shows error for invalid token", () => {
      setupMocks({
        tokenValidation: { valid: false, error: "TOKEN_INVALID" },
      });

      render(<FinishRegistrationContent token="invalid-token" />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByText("Lien d'invitation invalide"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Ce lien d'invitation n'est pas valide/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /contacter notre support/ }),
      ).toHaveAttribute(
        "href",
        "https://docs.aplus.beta.gouv.fr/contacter-lequipe",
      );
    });

    it("shows error for expired token", () => {
      setupMocks({
        tokenValidation: { valid: false, error: "TOKEN_EXPIRED" },
      });

      render(<FinishRegistrationContent token="expired-token" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Lien d'invitation expiré")).toBeInTheDocument();
      expect(
        screen.getByText(/Ce lien d'invitation n'est plus valide/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /contacter notre support/ }),
      ).toHaveAttribute(
        "href",
        "https://docs.aplus.beta.gouv.fr/contacter-lequipe",
      );
    });

    it("shows error when user already exists", () => {
      setupMocks({
        tokenValidation: { valid: false, error: "USER_EXISTS" },
      });

      render(<FinishRegistrationContent token="existing-user-token" />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByText(
          "Un compte existe déjà avec cette adresse e-mail. Vous pouvez vous connecter directement.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Registration form", () => {
    it("renders the form with prefilled data from pending user", async () => {
      setupMocks({
        tokenValidation: { valid: true, pendingUser: mockPendingUser },
      });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText("Informations personnelles")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Mot de passe" }),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    });

    it("displays the CGU checkbox", () => {
      setupMocks({
        tokenValidation: { valid: true, pendingUser: mockPendingUser },
      });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByText(/J'atteste avoir consulté les/i),
      ).toBeInTheDocument();
    });
  });

  describe("Form validation", () => {
    it("validates required firstName", async () => {
      const user = userEvent.setup();
      setupMocks({
        tokenValidation: {
          valid: true,
          pendingUser: { ...mockPendingUser, firstName: "" },
        },
      });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const submitButton = screen.getByRole("button", {
        name: /Terminer l'inscription/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Veuillez saisir votre prénom."),
        ).toBeInTheDocument();
      });
    });

    it("validates required lastName", async () => {
      const user = userEvent.setup();
      setupMocks({
        tokenValidation: {
          valid: true,
          pendingUser: { ...mockPendingUser, lastName: "" },
        },
      });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const submitButton = screen.getByRole("button", {
        name: /Terminer l'inscription/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Veuillez saisir votre nom."),
        ).toBeInTheDocument();
      });
    });

    it("validates password minimum length", async () => {
      const user = userEvent.setup();
      setupMocks({
        tokenValidation: { valid: true, pendingUser: mockPendingUser },
      });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText("Mot de passe");
      await user.type(passwordInput, "short");

      const submitButton = screen.getByRole("button", {
        name: /Terminer l'inscription/i,
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
      setupMocks({
        tokenValidation: { valid: true, pendingUser: mockPendingUser },
      });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText("Mot de passe");
      const confirmInput = screen.getByLabelText("Confirmer le mot de passe");

      await user.type(passwordInput, "Password123!");
      await user.type(confirmInput, "Different12!");

      const cguCheckbox = screen.getByRole("checkbox", { name: /J'atteste/i });
      await user.click(cguCheckbox);

      const submitButton = screen.getByRole("button", {
        name: /Terminer l'inscription/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Les mots de passe ne correspondent pas."),
        ).toBeInTheDocument();
      });
    });

    it("validates CGU acceptance", async () => {
      const user = userEvent.setup();
      setupMocks({
        tokenValidation: { valid: true, pendingUser: mockPendingUser },
      });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText("Mot de passe");
      const confirmInput = screen.getByLabelText("Confirmer le mot de passe");

      await user.type(passwordInput, "Password123!");
      await user.type(confirmInput, "Password123!");

      const submitButton = screen.getByRole("button", {
        name: /Terminer l'inscription/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Vous devez accepter les conditions générales d'utilisation.",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form submission", () => {
    it("submits form and redirects on success", async () => {
      const user = userEvent.setup();
      setupMocks({
        tokenValidation: { valid: true, pendingUser: mockPendingUser },
      });

      mockCompleteRegistration.mockResolvedValue({
        email: "test@example.com",
      });
      (signIn.email as jest.Mock).mockResolvedValue({ error: null });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText("Mot de passe");
      const confirmInput = screen.getByLabelText("Confirmer le mot de passe");

      await user.type(passwordInput, "Password123!");
      await user.type(confirmInput, "Password123!");

      const cguCheckbox = screen.getByRole("checkbox", { name: /J'atteste/i });
      await user.click(cguCheckbox);

      const submitButton = screen.getByRole("button", {
        name: /Terminer l'inscription/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCompleteRegistration).toHaveBeenCalledWith({
          token: "valid-token",
          firstName: "John",
          lastName: "Doe",
          password: "Password123!",
          passwordConfirmation: "Password123!",
          phone: null,
          profession: null,
          cguAccepted: true,
        });
      });

      await waitFor(() => {
        expect(signIn.email).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "Password123!",
        });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("redirects to login page on sign-in failure", async () => {
      const user = userEvent.setup();
      setupMocks({
        tokenValidation: { valid: true, pendingUser: mockPendingUser },
      });

      mockCompleteRegistration.mockResolvedValue({
        email: "test@example.com",
      });
      (signIn.email as jest.Mock).mockResolvedValue({
        error: { message: "Sign in failed" },
      });

      render(<FinishRegistrationContent token="valid-token" />, {
        wrapper: createWrapper(),
      });

      const passwordInput = screen.getByLabelText("Mot de passe");
      const confirmInput = screen.getByLabelText("Confirmer le mot de passe");

      await user.type(passwordInput, "Password123!");
      await user.type(confirmInput, "Password123!");

      const cguCheckbox = screen.getByRole("checkbox", { name: /J'atteste/i });
      await user.click(cguCheckbox);

      const submitButton = screen.getByRole("button", {
        name: /Terminer l'inscription/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/connexion");
      });
    });
  });
});
