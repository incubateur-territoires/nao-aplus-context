import { render, screen } from "@testing-library/react";
import { NoTeamGuard } from "./no-team-guard";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { ROUTE } from "@/app/constant/route";
import { USER_ROLES } from "@/constants/user-roles";
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

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

const CHILDREN_TEXT = "Contenu protégé";
const ALERT_TITLE = "Utilisateur retiré de l’équipe";

function setup({
  role = USER_ROLES.USER,
  teams = [{ id: MOCK_IDS.TEAM_1 }],
  pathname = ROUTE.ALL_REPORTS,
  authenticated = true,
  isUserPending = false,
}: {
  role?: string;
  teams?: { id: string }[];
  pathname?: string;
  authenticated?: boolean;
  isUserPending?: boolean;
} = {}) {
  (usePathname as jest.Mock).mockReturnValue(pathname);
  (useSession as jest.Mock).mockReturnValue({
    data: authenticated ? { user: { id: MOCK_IDS.USER_1, role } } : null,
    isPending: false,
  });
  (useTRPC as jest.Mock).mockReturnValue({
    user: {
      getCurrentUser: { queryOptions: jest.fn().mockReturnValue({}) },
    },
  });
  (useQuery as jest.Mock).mockReturnValue({
    data: { id: MOCK_IDS.USER_1, role, teams },
    isPending: isUserPending,
  });
}

describe("NoTeamGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children when the user belongs to at least one team", () => {
    setup({ teams: [{ id: MOCK_IDS.TEAM_1 }] });
    render(
      <NoTeamGuard>
        <div>{CHILDREN_TEXT}</div>
      </NoTeamGuard>,
    );
    expect(screen.getByText(CHILDREN_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument();
  });

  it("renders the no-team alert when the user has no team", () => {
    setup({ teams: [] });
    render(
      <NoTeamGuard>
        <div>{CHILDREN_TEXT}</div>
      </NoTeamGuard>,
    );
    expect(screen.getByText(ALERT_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(CHILDREN_TEXT)).not.toBeInTheDocument();
  });

  it("renders children for an admin even without any team", () => {
    setup({ role: USER_ROLES.ADMIN, teams: [] });
    render(
      <NoTeamGuard>
        <div>{CHILDREN_TEXT}</div>
      </NoTeamGuard>,
    );
    expect(screen.getByText(CHILDREN_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument();
  });

  it("renders children for a supervisor even without any team", () => {
    setup({ role: USER_ROLES.SUPERVISOR, teams: [] });
    render(
      <NoTeamGuard>
        <div>{CHILDREN_TEXT}</div>
      </NoTeamGuard>,
    );
    expect(screen.getByText(CHILDREN_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument();
  });

  it("renders children on whitelisted routes (profile)", () => {
    setup({ teams: [], pathname: ROUTE.PROFILE });
    render(
      <NoTeamGuard>
        <div>{CHILDREN_TEXT}</div>
      </NoTeamGuard>,
    );
    expect(screen.getByText(CHILDREN_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument();
  });

  it("renders children when the user is not authenticated", () => {
    setup({ authenticated: false });
    render(
      <NoTeamGuard>
        <div>{CHILDREN_TEXT}</div>
      </NoTeamGuard>,
    );
    expect(screen.getByText(CHILDREN_TEXT)).toBeInTheDocument();
  });

  it("renders children while the current-user query is loading", () => {
    setup({ teams: [], isUserPending: true });
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
    });
    render(
      <NoTeamGuard>
        <div>{CHILDREN_TEXT}</div>
      </NoTeamGuard>,
    );
    expect(screen.getByText(CHILDREN_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument();
  });
});
