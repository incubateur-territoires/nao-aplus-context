import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "./contact-form";
import { mockUseMutation, mockUseQuery } from "@/test/utils/global-mocks";

// jsdom n'implémente pas scrollIntoView (appelé par useFocusOnVisible)
Element.prototype.scrollIntoView = jest.fn();

function mockMutation(overrides = {}) {
  mockUseMutation.mockImplementation(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    ...overrides,
  }));
}

function mockCurrentUser(user: unknown) {
  mockUseQuery.mockImplementation(() => ({
    data: user,
    isLoading: false,
    error: null,
  }));
}

const LOGGED_IN_USER = {
  email: "john.doe@example.com",
  firstName: "John",
  lastName: "Doe",
  teams: [{ id: "team-1", name: "France services Lyon" }],
};

describe("ContactForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutation();
    // Logged out by default
    mockCurrentUser(null);
  });

  it("renders the heading, intro link and all fields", () => {
    render(<ContactForm />);

    expect(
      screen.getByRole("heading", {
        name: "Vous ne trouvez pas la réponse à votre question ?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /dans notre aide en ligne/ }),
    ).toHaveAttribute("href", "https://docs.aplus.beta.gouv.fr/");
    expect(
      screen.getByText("Adresse e-mail de votre compte A+"),
    ).toBeInTheDocument();
    expect(screen.getByText("Prénom")).toBeInTheDocument();
    expect(screen.getByText("Nom")).toBeInTheDocument();
    expect(
      screen.getByText("Équipe concernée (optionnel)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sujet du message")).toBeInTheDocument();
    expect(screen.getByText("Message")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Envoyer le message" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Parcourir/ }),
    ).toBeInTheDocument();
  });

  it("shows validation errors and does not submit when fields are empty", async () => {
    const mutate = jest.fn();
    mockMutation({ mutate });
    const user = userEvent.setup();

    render(<ContactForm />);
    await user.click(
      screen.getByRole("button", { name: "Envoyer le message" }),
    );

    expect(
      await screen.findByText("Veuillez saisir une adresse e-mail."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Veuillez saisir votre prénom."),
    ).toBeInTheDocument();
    expect(screen.getByText("Veuillez saisir votre nom.")).toBeInTheDocument();
    expect(
      screen.getByText("Veuillez saisir le sujet de votre message."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Veuillez saisir votre message."),
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not require the optional team field when logged out", async () => {
    const mutate = jest.fn();
    mockMutation({ mutate });
    const user = userEvent.setup();

    render(<ContactForm />);

    await user.type(
      screen.getByLabelText(/Adresse e-mail de votre compte A\+/),
      "jean@example.com",
    );
    await user.type(screen.getByLabelText("Prénom"), "Jean");
    await user.type(screen.getByLabelText("Nom"), "Dupont");
    await user.type(
      screen.getByLabelText("Sujet du message"),
      "Demande d'aide",
    );
    await user.type(
      screen.getByLabelText("Message"),
      "Bonjour, j'ai besoin d'aide.",
    );
    await user.click(
      screen.getByRole("button", { name: "Envoyer le message" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "jean@example.com",
          firstName: "Jean",
          lastName: "Dupont",
          subject: "Demande d'aide",
          message: "Bonjour, j'ai besoin d'aide.",
        }),
      );
    });
  });

  it("prefills and disables identity fields when the user is logged in", () => {
    mockCurrentUser(LOGGED_IN_USER);

    render(<ContactForm />);

    const email = screen.getByLabelText(/Adresse e-mail de votre compte A\+/);
    const firstName = screen.getByLabelText("Prénom");
    const lastName = screen.getByLabelText("Nom");

    expect(email).toHaveValue("john.doe@example.com");
    expect(firstName).toHaveValue("John");
    expect(lastName).toHaveValue("Doe");
    expect(email).toBeDisabled();
    expect(firstName).toBeDisabled();
    expect(lastName).toBeDisabled();
  });

  it("prefills and disables the team field when the user has a single team", () => {
    mockCurrentUser(LOGGED_IN_USER);

    render(<ContactForm />);

    const team = screen.getByLabelText("Équipe concernée");
    expect(team).toHaveValue("France services Lyon");
    expect(team).toBeDisabled();
    expect(
      screen.queryByText("Équipe concernée (optionnel)"),
    ).not.toBeInTheDocument();
  });

  it("renders a team select when the user has multiple teams", () => {
    mockCurrentUser({
      ...LOGGED_IN_USER,
      teams: [
        { id: "team-1", name: "France services Lyon" },
        { id: "team-2", name: "France services Paris" },
      ],
    });

    render(<ContactForm />);

    const select = screen.getByLabelText("Équipe concernée (optionnel)");
    expect(select.tagName).toBe("SELECT");
    expect(
      screen.getByRole("option", { name: "France services Lyon" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "France services Paris" }),
    ).toBeInTheDocument();
  });

  it("submits the prefilled identity and team values when logged in", async () => {
    const mutate = jest.fn();
    mockMutation({ mutate });
    mockCurrentUser(LOGGED_IN_USER);
    const user = userEvent.setup();

    render(<ContactForm />);

    await user.type(
      screen.getByLabelText("Sujet du message"),
      "Demande d'aide",
    );
    await user.type(
      screen.getByLabelText("Message"),
      "Bonjour, j'ai besoin d'aide.",
    );
    await user.click(
      screen.getByRole("button", { name: "Envoyer le message" }),
    );

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
        team: "France services Lyon",
        subject: "Demande d'aide",
        message: "Bonjour, j'ai besoin d'aide.",
        attachments: [],
      });
    });
  });

  it("shows the server error message when the mutation fails", () => {
    mockMutation({
      isError: true,
      error: {
        message:
          "Vous avez envoyé trop de messages. Veuillez réessayer plus tard.",
        data: { code: "TOO_MANY_REQUESTS" },
      },
    });

    render(<ContactForm />);

    expect(
      screen.getByText("L'envoi du message a échoué."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Vous avez envoyé trop de messages. Veuillez réessayer plus tard.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a generic French message for a network error (no server data)", () => {
    mockMutation({
      isError: true,
      error: { message: "Failed to fetch", data: null },
    });

    render(<ContactForm />);

    expect(
      screen.getByText("L'envoi du message a échoué."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Une erreur est survenue lors de l'envoi de votre message. Vérifiez votre connexion et réessayez.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });

  it("disables the submit button while the mutation is pending", () => {
    mockMutation({ isPending: true });

    render(<ContactForm />);

    expect(
      screen.getByRole("button", { name: "Envoyer le message" }),
    ).toBeDisabled();
  });
});
