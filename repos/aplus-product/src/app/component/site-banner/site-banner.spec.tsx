import { render, screen } from "@testing-library/react";
import { SiteBanner } from "./site-banner";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { MOCK_IDS } from "@/test/mocks";

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

const BANNER_CONTENT = "Maintenance prévue ce soir";

interface Banner {
  content: string;
  severity: "info" | "warning" | "alert";
  displayOnPublicPages: boolean;
}

function setup({
  banner = null,
  authenticated = true,
  isSessionPending = false,
}: {
  banner?: Banner | null;
  authenticated?: boolean;
  isSessionPending?: boolean;
} = {}) {
  (useSession as jest.Mock).mockReturnValue({
    data: authenticated ? { user: { id: MOCK_IDS.USER_1 } } : null,
    isPending: isSessionPending,
  });
  (useTRPC as jest.Mock).mockReturnValue({
    banner: {
      get: { queryOptions: jest.fn().mockReturnValue({}) },
    },
  });
  (useQuery as jest.Mock).mockReturnValue({ data: banner });
}

describe("SiteBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ne rend rien quand aucun bandeau n'est publié", () => {
    setup({ banner: null });
    const { container } = render(<SiteBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche le contenu du bandeau quand il est publié", () => {
    setup({
      banner: {
        content: BANNER_CONTENT,
        severity: "info",
        displayOnPublicPages: false,
      },
    });
    render(<SiteBanner />);
    expect(screen.getByText(BANNER_CONTENT)).toBeInTheDocument();
  });

  it('restitue une alerte (rouge) via role="alert"', () => {
    setup({
      banner: {
        content: BANNER_CONTENT,
        severity: "alert",
        displayOnPublicPages: false,
      },
    });
    render(<SiteBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it('restitue une information via role="status" (poli)', () => {
    setup({
      banner: {
        content: BANNER_CONTENT,
        severity: "info",
        displayOnPublicPages: false,
      },
    });
    render(<SiteBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it('restitue un avertissement via role="status" (poli)', () => {
    setup({
      banner: {
        content: BANNER_CONTENT,
        severity: "warning",
        displayOnPublicPages: false,
      },
    });
    render(<SiteBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("masque le bandeau aux visiteurs non connectés quand il n'est pas public", () => {
    setup({
      banner: {
        content: BANNER_CONTENT,
        severity: "info",
        displayOnPublicPages: false,
      },
      authenticated: false,
    });
    const { container } = render(<SiteBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche le bandeau aux visiteurs non connectés quand il est public", () => {
    setup({
      banner: {
        content: BANNER_CONTENT,
        severity: "info",
        displayOnPublicPages: true,
      },
      authenticated: false,
    });
    render(<SiteBanner />);
    expect(screen.getByText(BANNER_CONTENT)).toBeInTheDocument();
  });
});
