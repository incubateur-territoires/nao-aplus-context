import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SigninForm } from "./signin-form";
import { signIn } from "@/lib/auth-client";

const mockReplace = jest.fn();
const mockGet = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

jest.mock("@/lib/auth-client", () => ({
  signIn: {
    email: jest.fn(),
  },
}));

describe("SigninForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  it("renders the form with email and password inputs", () => {
    render(<SigninForm />);

    expect(
      screen.getByRole("heading", { name: "Connexion avec mot de passe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Adresse e-mail (obligatoire)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mot de passe (obligatoire)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Se connecter" }),
    ).toBeInTheDocument();
  });

  it("shows no alert when there is no error", () => {
    render(<SigninForm />);

    expect(screen.queryByTestId("error-message")).not.toBeInTheDocument();
  });

  it("shows credentials error alert", () => {
    mockGet.mockImplementation((key: string) =>
      key === "error" ? "CredentialsSignin" : null,
    );

    render(<SigninForm />);

    expect(screen.getByTestId("error-message")).toBeInTheDocument();
    expect(
      screen.getByText("Adresse e-mail ou mot de passe invalide."),
    ).toBeInTheDocument();
  });

  it("shows account pending alert", () => {
    mockGet.mockImplementation((key: string) =>
      key === "error" ? "AccountPending" : null,
    );

    render(<SigninForm />);

    expect(screen.getByTestId("error-message")).toBeInTheDocument();
    expect(
      screen.getByText(/Un administrateur doit l'activer/),
    ).toBeInTheDocument();
  });

  it("shows access denied alert", () => {
    mockGet.mockImplementation((key: string) =>
      key === "error" ? "AccessDenied" : null,
    );

    render(<SigninForm />);

    expect(screen.getByTestId("error-message")).toBeInTheDocument();
    expect(
      screen.getByText(/consulter le courriel de confirmation/),
    ).toBeInTheDocument();
  });

  it("shows account inactive alert", () => {
    mockGet.mockImplementation((key: string) =>
      key === "error" ? "AccountInactive" : null,
    );

    render(<SigninForm />);

    expect(screen.getByTestId("error-message")).toBeInTheDocument();
    expect(screen.getByText(/Ce compte a été désactivé/)).toBeInTheDocument();
  });

  it("shows rate limit alert", () => {
    mockGet.mockImplementation((key: string) =>
      key === "error" ? "RateLimited" : null,
    );

    render(<SigninForm />);

    expect(screen.getByTestId("error-message")).toBeInTheDocument();
    expect(
      screen.getByText("Trop de tentatives de connexion"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Vous avez effectué trop de tentatives de connexion/),
    ).toBeInTheDocument();
  });

  it("shows default error for unknown error codes", () => {
    mockGet.mockImplementation((key: string) =>
      key === "error" ? "UnknownError" : null,
    );

    render(<SigninForm />);

    expect(screen.getByTestId("error-message")).toBeInTheDocument();
    expect(
      screen.getByText("Une erreur est survenue lors de la connexion."),
    ).toBeInTheDocument();
  });

  it("shows forgot password link", () => {
    render(<SigninForm />);

    expect(
      screen.getByRole("link", { name: "Mot de passe oublié ?" }),
    ).toHaveAttribute("href", "/mot-de-passe-oublie");
  });

  it("shows test users button when enabled", () => {
    const originalEnv = process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS;
    process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS = "true";
    const mockOpenTestUsers = jest.fn();

    render(<SigninForm onOpenTestUsers={mockOpenTestUsers} />);

    expect(
      screen.getByRole("button", { name: "Utilisateur de test" }),
    ).toBeInTheDocument();

    process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS = originalEnv;
  });

  it("does not show test users button when disabled", () => {
    const originalEnv = process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS;
    process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS = "false";

    render(<SigninForm />);

    expect(
      screen.queryByRole("button", { name: "Utilisateur de test" }),
    ).not.toBeInTheDocument();

    process.env.NEXT_PUBLIC_ENABLE_DEBUG_TOOLS = originalEnv;
  });

  describe("client-side validation", () => {
    it("shows accessible field errors and does not call signIn when fields are empty", async () => {
      const user = userEvent.setup();

      render(<SigninForm />);

      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      expect(
        await screen.findByText("Veuillez saisir votre adresse e-mail."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Veuillez saisir votre mot de passe."),
      ).toBeInTheDocument();
      expect(signIn.email).not.toHaveBeenCalled();
    });

    it("shows an error for an invalid email format", async () => {
      const user = userEvent.setup();

      render(<SigninForm />);

      await user.type(screen.getByLabelText(/Adresse e-mail/), "not-an-email");
      await user.type(screen.getByLabelText(/Mot de passe/), "password123");
      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      expect(
        await screen.findByText(
          "Veuillez saisir une adresse e-mail valide. Exemple : m.dupont@gmail.com",
        ),
      ).toBeInTheDocument();
      expect(signIn.email).not.toHaveBeenCalled();
    });

    it("calls signIn with a lowercased email when the form is valid", async () => {
      const user = userEvent.setup();
      (signIn.email as jest.Mock).mockResolvedValue({ error: null });

      render(<SigninForm />);

      await user.type(
        screen.getByLabelText(/Adresse e-mail/),
        "Test@Example.com",
      );
      await user.type(screen.getByLabelText(/Mot de passe/), "password123");
      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      await waitFor(() => {
        expect(signIn.email).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "test@example.com",
            password: "password123",
          }),
        );
      });
    });
  });

  describe("returnTo redirect", () => {
    async function submitValidForm() {
      const user = userEvent.setup();
      render(<SigninForm />);
      await user.type(
        screen.getByLabelText(/Adresse e-mail/),
        "test@example.com",
      );
      await user.type(screen.getByLabelText(/Mot de passe/), "password123");
      await user.click(screen.getByRole("button", { name: "Se connecter" }));
    }

    it("uses an internal returnTo as the callbackURL", async () => {
      (signIn.email as jest.Mock).mockResolvedValue({ error: null });
      mockGet.mockImplementation((key: string) =>
        key === "returnTo" ? "/signalement/abc123" : null,
      );

      await submitValidForm();

      await waitFor(() => {
        expect(signIn.email).toHaveBeenCalledWith(
          expect.objectContaining({ callbackURL: "/signalement/abc123" }),
        );
      });
    });

    it("falls back to all reports when there is no returnTo", async () => {
      (signIn.email as jest.Mock).mockResolvedValue({ error: null });

      await submitValidForm();

      await waitFor(() => {
        expect(signIn.email).toHaveBeenCalledWith(
          expect.objectContaining({ callbackURL: "/tous-les-signalements" }),
        );
      });
    });

    it("ignores an external returnTo (open redirect protection)", async () => {
      (signIn.email as jest.Mock).mockResolvedValue({ error: null });
      mockGet.mockImplementation((key: string) =>
        key === "returnTo" ? "https://evil.com" : null,
      );

      await submitValidForm();

      await waitFor(() => {
        expect(signIn.email).toHaveBeenCalledWith(
          expect.objectContaining({ callbackURL: "/tous-les-signalements" }),
        );
      });
    });
  });
});
