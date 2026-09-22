import { render, screen, waitFor } from "@testing-library/react";
import { Content } from "./connexion-content";

const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockGet = jest.fn();
const mockToString = jest.fn(() => "");
const mockClear = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    refresh: mockRefresh,
    push: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: mockGet,
    toString: mockToString,
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: () => ({
    clear: mockClear,
  }),
}));

const mockRefetch = jest.fn();
let mockSession: { data: unknown; isPending: boolean; refetch: jest.Mock } = {
  data: null,
  isPending: false,
  refetch: mockRefetch,
};

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => mockSession,
}));

jest.mock("@/app/component/impersonation-widget/impersonation-widget", () => ({
  ImpersonationWidget: () => null,
}));

jest.mock("@/lib/auth-client", () => ({
  signIn: { email: jest.fn() },
}));

jest.mock("@/app/hooks/use-analytics", () => ({
  useAnalytics: () => ({ track: jest.fn() }),
}));

describe("Content (connexion page)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockSession = { data: null, isPending: false, refetch: mockRefetch };
    mockRefetch.mockResolvedValue(null);
  });

  it("renders the connexion page", () => {
    render(<Content />);

    expect(
      screen.getByRole("heading", { name: "Connexion à Administration+" }),
    ).toBeInTheDocument();
  });

  it("prefills email from search params", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "email") return "n.cirot.fs@orange.fr";
      return null;
    });

    render(<Content />);

    const emailInput = screen.getByRole("textbox", { name: /adresse e-mail/i });
    expect(emailInput).toHaveValue("n.cirot.fs@orange.fr");
  });

  it("does not prefill email when no email param", () => {
    render(<Content />);

    const emailInput = screen.getByRole("textbox", { name: /adresse e-mail/i });
    expect(emailInput).toHaveValue("");
  });

  describe("redirect when already logged in", () => {
    const loggedInSession = { user: { id: "1" } };

    function mockLoggedIn() {
      mockSession = {
        data: loggedInSession,
        isPending: false,
        refetch: mockRefetch,
      };
      mockRefetch.mockResolvedValue(loggedInSession);
    }

    it("redirects to the internal returnTo", async () => {
      mockLoggedIn();
      mockGet.mockImplementation((key: string) =>
        key === "returnTo" ? "/signalement/abc123" : null,
      );

      render(<Content />);

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/signalement/abc123"),
      );
    });

    it("redirects to all reports when there is no returnTo", async () => {
      mockLoggedIn();

      render(<Content />);

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/tous-les-signalements"),
      );
    });

    it("ignores an external returnTo (open redirect protection)", async () => {
      mockLoggedIn();
      mockGet.mockImplementation((key: string) =>
        key === "returnTo" ? "//evil.com" : null,
      );

      render(<Content />);

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/tous-les-signalements"),
      );
    });

    it("does not redirect when the server no longer knows the session (revoked)", async () => {
      // Cache client encore peuplé mais session révoquée côté serveur :
      // le refetch renvoie null → pas de redirection (sinon boucle
      // /connexion ↔ returnTo via le proxy).
      mockSession = {
        data: loggedInSession,
        isPending: false,
        refetch: mockRefetch,
      };
      mockRefetch.mockResolvedValue(null);
      mockGet.mockImplementation((key: string) =>
        key === "returnTo" ? "/signalement/abc123" : null,
      );

      render(<Content />);

      await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
      expect(mockReplace).not.toHaveBeenCalled();
      // Re-rendu serveur du layout pour resynchroniser le header (Server
      // Component conservé « connecté » par le Router Cache).
      await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    });
  });
});
