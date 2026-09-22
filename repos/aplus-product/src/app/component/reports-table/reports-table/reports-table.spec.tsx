import { render, screen } from "@testing-library/react";
import { ReportsTable } from "./reports-table";
import { ReportMode } from "@/types/report-mode";
import { createMockUser, createMockReports } from "@/test/mocks";

// Mock the usePaginatedReports hook
const mockUsePaginatedReports = {
  reports: createMockReports(),
  isLoading: false,
  isFetching: false,
  page: 1,
  setPage: jest.fn(),
  pageSize: 10,
  totalCount: 2,
  totalPages: 1,
  statusFilters: [],
  setStatusFilters: jest.fn(),
  teamsFilters: [],
  setTeamsFilters: jest.fn(),
  searchQuery: "",
  setSearchQuery: jest.fn(),
  selectedMyReports: false,
  handleMyReportsToggle: jest.fn(),
  selectedMyAnsweredReports: false,
  handleMyAnsweredReportsToggle: jest.fn(),
  resetFilters: jest.fn(),
};

jest.mock("../use-paginated-reports/use-paginated-reports", () => ({
  usePaginatedReports: () => mockUsePaginatedReports,
  ReportTableItem: {},
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/tous-les-signalements",
}));

const mockCurrentUser = createMockUser();

const defaultProps = {
  mode: ReportMode.CREATED,
  currentUser: mockCurrentUser,
};

describe("ReportsTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePaginatedReports.reports = createMockReports();
    mockUsePaginatedReports.isLoading = false;
    mockUsePaginatedReports.totalCount = 2;
  });

  it("renders table with reports", () => {
    render(<ReportsTable {...defaultProps} />);
    expect(screen.getByText("Emma Bouchard")).toBeInTheDocument();
    expect(screen.getByText("Rémi Chevalier")).toBeInTheDocument();
  });

  it("renders status badges", () => {
    render(<ReportsTable {...defaultProps} />);
    const statusBadges = screen.getAllByTestId("status-badge");
    expect(statusBadges).toHaveLength(2);
  });

  it("renders action buttons", () => {
    render(<ReportsTable {...defaultProps} />);
    const viewButtons = screen.getAllByText("Voir");
    expect(viewButtons.length).toBeGreaterThan(0);
  });

  it("renders filters section", () => {
    render(<ReportsTable {...defaultProps} />);
    expect(screen.getByText("Filtrer les signalements")).toBeInTheDocument();
    expect(screen.getByText("Par état :")).toBeInTheDocument();
  });

  it("shows loading state when isLoading is true", () => {
    mockUsePaginatedReports.isLoading = true;
    render(<ReportsTable {...defaultProps} />);
    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<ReportsTable {...defaultProps} />);
    expect(screen.getByText("Nom du citoyen")).toBeInTheDocument();
    expect(screen.getByText("Sujet du signalement")).toBeInTheDocument();
    expect(screen.getByText("Nom de l’auteur")).toBeInTheDocument();
    expect(screen.getByText("Équipe de l’auteur")).toBeInTheDocument();
    expect(screen.getByText("Création")).toBeInTheDocument();
    expect(screen.getByText("Dernier msg")).toBeInTheDocument();
  });

  it("does not apply opacity class", () => {
    const { container } = render(<ReportsTable {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toContain("opacity");
  });
});
