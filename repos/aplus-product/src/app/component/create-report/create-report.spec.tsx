import { render, screen } from "@testing-library/react";
import { CreateReport } from "./create-report";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { ROUTE } from "@/app/constant/route";
import { OrganizationRole } from "@/generated/prisma/enums";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { MOCK_IDS, USER_ROLES } from "@/test/mocks";

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

describe("CreateReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTRPC as jest.Mock).mockReturnValue({
      user: {
        getCurrentUser: {
          queryOptions: jest.fn().mockReturnValue({}),
        },
      },
    });
  });

  it("renders the create report section regardless of user teams", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        id: MOCK_IDS.USER_1,
        role: USER_ROLES.USER,
        teams: [{ id: MOCK_IDS.TEAM_1, role: OrganizationRole.OPERATOR }],
      },
    });

    render(<CreateReport />);

    expect(
      screen.getByRole("heading", { name: "Créer un nouveau signalement" }),
    ).toBeInTheDocument();
  });

  it("renders the create report section when session is undefined", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: undefined,
    });
    (useQuery as jest.Mock).mockReturnValue({ data: undefined });

    render(<CreateReport />);

    expect(
      screen.getByRole("heading", { name: "Créer un nouveau signalement" }),
    ).toBeInTheDocument();
  });

  it("renders the create report section when currentUser is undefined", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1 } },
    });
    (useQuery as jest.Mock).mockReturnValue({ data: undefined });

    render(<CreateReport />);

    expect(
      screen.getByRole("heading", { name: "Créer un nouveau signalement" }),
    ).toBeInTheDocument();
  });

  it("renders the create report section when user has a HELPER team", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        id: MOCK_IDS.USER_1,
        role: USER_ROLES.USER,
        teams: [{ id: MOCK_IDS.TEAM_1, role: OrganizationRole.HELPER }],
      },
    });

    render(<CreateReport />);

    expect(
      screen.getByRole("heading", { name: "Créer un nouveau signalement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Pour créer un signalement, vous aurez besoin des nom, prénom/,
      ),
    ).toBeInTheDocument();
  });

  it("renders the create link", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        id: MOCK_IDS.USER_1,
        role: USER_ROLES.USER,
        teams: [{ id: MOCK_IDS.TEAM_1, role: OrganizationRole.HELPER }],
      },
    });

    render(<CreateReport />);

    const link = screen.getByRole("link", {
      name: /Créer un nouveau signalement/,
    });
    expect(link).toBeInTheDocument();
  });

  it("has correct href for new report step 1", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        id: MOCK_IDS.USER_1,
        role: USER_ROLES.USER,
        teams: [{ id: MOCK_IDS.TEAM_1, role: OrganizationRole.HELPER }],
      },
    });

    render(<CreateReport />);

    const link = screen.getByRole("link", {
      name: /Créer un nouveau signalement/,
    });

    expect(link).toHaveAttribute("href", ROUTE.NEW_REPORT_STEP_1);
  });

  it("renders when user has both OPERATOR and HELPER teams", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        id: MOCK_IDS.USER_1,
        role: USER_ROLES.USER,
        teams: [
          { id: MOCK_IDS.TEAM_1, role: OrganizationRole.OPERATOR },
          { id: MOCK_IDS.TEAM_2, role: OrganizationRole.HELPER },
        ],
      },
    });

    render(<CreateReport />);

    expect(
      screen.getByRole("heading", { name: "Créer un nouveau signalement" }),
    ).toBeInTheDocument();
  });

  it("displays empty message instead of heading when hasNoReports is true", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: MOCK_IDS.USER_1, role: USER_ROLES.USER } },
    });
    (useQuery as jest.Mock).mockReturnValue({ data: undefined });

    render(<CreateReport hasNoReports />);

    expect(
      screen.getByText("Aucun signalement à afficher"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Créer un nouveau signalement" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Créer un nouveau signalement/ }),
    ).toBeInTheDocument();
  });
});
