import { render, screen } from "@testing-library/react";
import { ReportsTableFilters } from "./reports-table-filters";
import { ReportStatus } from "@/generated/prisma/enums";
import { ReportMode } from "@/types/report-mode";
import {
  createMockUser,
  createMockFunctions,
  createMockTeam,
} from "@/test/mocks";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe("ReportsTableFilters", () => {
  const mockFunctions = createMockFunctions();
  const mockCurrentUser = createMockUser({
    teams: [
      createMockTeam({ id: "team-1", name: "Équipe A" }),
      createMockTeam({ id: "team-2", name: "Équipe B" }),
    ],
  });

  const defaultProps = {
    handleMyReportsToggle: mockFunctions.handleMyReportsToggle,
    selectedMyReports: false,
    selectedMyAnsweredReports: false,
    handleMyAnsweredReportsToggle: jest.fn(),
    currentUser: mockCurrentUser,
    searchQuery: "",
    setSearchQuery: mockFunctions.setSearchQuery,
    selectedStatuses: [] as ReportStatus[],
    onStatusFilterChange: mockFunctions.onStatusFilterChange,
    selectedTeams: [] as string[],
    onTeamFilterChange: mockFunctions.onTeamFilterChange,
    mode: ReportMode.CREATED,
    totalCount: 10,
    selectedOverdueOnly: false,
    handleOverdueToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders filter section title", () => {
    render(<ReportsTableFilters {...defaultProps} />);
    expect(screen.getByText("Filtrer les signalements")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<ReportsTableFilters {...defaultProps} />);
    expect(screen.getByText("Rechercher")).toBeInTheDocument();
  });

  it("renders team filter when user has teams", () => {
    render(<ReportsTableFilters {...defaultProps} />);
    expect(screen.getByText("Par équipe :")).toBeInTheDocument();
    expect(screen.getByText("Équipe A")).toBeInTheDocument();
    expect(screen.getByText("Équipe B")).toBeInTheDocument();
  });

  it("renders status filter", () => {
    render(<ReportsTableFilters {...defaultProps} />);
    expect(screen.getByText("Par état :")).toBeInTheDocument();
  });

  it("shows my reports toggle in CREATED mode", () => {
    render(<ReportsTableFilters {...defaultProps} />);
    expect(
      screen.getByText("Voir uniquement les signalements que vous avez créés"),
    ).toBeInTheDocument();
  });

  it("shows my answered reports toggle in REQUESTED mode", () => {
    render(
      <ReportsTableFilters {...defaultProps} mode={ReportMode.REQUESTED} />,
    );
    expect(
      screen.getByText(
        "Voir uniquement les signalements auxquels vous avez répondu",
      ),
    ).toBeInTheDocument();
  });

  it("shows team reset button when teams are selected", () => {
    render(
      <ReportsTableFilters {...defaultProps} selectedTeams={["team-1"]} />,
    );
    expect(screen.getByText("Réinitialiser les filtres")).toBeInTheDocument();
  });

  it("shows status reset button when statuses are selected", () => {
    render(
      <ReportsTableFilters
        {...defaultProps}
        selectedStatuses={[ReportStatus.PENDING_ASSIGNMENT]}
      />,
    );
    expect(screen.getByText("Réinitialiser les filtres")).toBeInTheDocument();
  });

  it("does not show reset buttons when no filters selected", () => {
    render(<ReportsTableFilters {...defaultProps} />);
    expect(
      screen.queryByText("Réinitialiser les filtres"),
    ).not.toBeInTheDocument();
  });

  it("does not render team filter when user has no teams", () => {
    const userWithNoTeams = createMockUser({ teams: [] });
    render(
      <ReportsTableFilters {...defaultProps} currentUser={userWithNoTeams} />,
    );
    expect(screen.queryByText("Par équipe :")).not.toBeInTheDocument();
  });

  it("does not render team filter when user is undefined", () => {
    render(<ReportsTableFilters {...defaultProps} currentUser={undefined} />);
    expect(screen.queryByText("Par équipe :")).not.toBeInTheDocument();
  });

  it("renders all status options", () => {
    render(<ReportsTableFilters {...defaultProps} />);
    expect(
      screen.getByText("En attente de prise en charge"),
    ).toBeInTheDocument();
    expect(screen.getByText("En cours de traitement")).toBeInTheDocument();
    expect(screen.getByText("Traité")).toBeInTheDocument();
    expect(screen.getByText("Fermé")).toBeInTheDocument();
  });

  it("renders correct title for CREATED mode", () => {
    render(<ReportsTableFilters {...defaultProps} mode={ReportMode.CREATED} />);
    expect(
      screen.getByText(/Signalements créés par votre équipe/),
    ).toBeInTheDocument();
  });

  it("renders correct title for REQUESTED mode", () => {
    render(
      <ReportsTableFilters {...defaultProps} mode={ReportMode.REQUESTED} />,
    );
    expect(screen.getByText(/Signalements à examiner/)).toBeInTheDocument();
  });

  it("renders create report button", () => {
    render(<ReportsTableFilters {...defaultProps} />);
    expect(
      screen.getByText("Créer un nouveau signalement"),
    ).toBeInTheDocument();
  });

  it("hides create report button for supervisors", () => {
    const supervisorUser = createMockUser({ role: "supervisor" });
    render(
      <ReportsTableFilters {...defaultProps} currentUser={supervisorUser} />,
    );
    expect(
      screen.queryByText("Créer un nouveau signalement"),
    ).not.toBeInTheDocument();
  });
});
