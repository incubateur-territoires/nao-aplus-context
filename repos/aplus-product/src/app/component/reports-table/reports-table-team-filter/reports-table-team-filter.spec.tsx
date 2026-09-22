import { render, screen, fireEvent } from "@testing-library/react";
import { ReportsTableTeamFilter } from "./reports-table-team-filter";
import React from "react";

// Mock DSFR components
jest.mock("@codegouvfr/react-dsfr/Tag", () => {
  return function MockTag({
    children,
    pressed,
    nativeButtonProps,
  }: {
    children: React.ReactNode;
    pressed?: boolean;
    nativeButtonProps?: {
      onClick?: (e: React.MouseEvent) => void;
      suppressHydrationWarning?: boolean;
    };
  }) {
    return (
      <button
        role="button"
        aria-pressed={pressed}
        onClick={nativeButtonProps?.onClick}
      >
        {children}
      </button>
    );
  };
});

jest.mock("@codegouvfr/react-dsfr/Button", () => {
  return function MockButton({
    children,
    onClick,
    type,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
    className?: string;
  }) {
    return (
      <button type={type} onClick={onClick} className={className}>
        {children}
      </button>
    );
  };
});

import {
  createMockFunctions,
  createMockReportTeam,
  MOCK_IDS,
} from "@/test/mocks";

describe("ReportsTableTeamFilter", () => {
  const mockFunctions = createMockFunctions();
  const mockOnTeamFilterChange = mockFunctions.onTeamFilterChange;
  const mockTeams = [
    createMockReportTeam({ id: MOCK_IDS.TEAM_1, name: "Team Alpha" }),
    createMockReportTeam({ id: MOCK_IDS.TEAM_2, name: "Team Beta" }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when userTeams is empty", () => {
    const { container } = render(
      <ReportsTableTeamFilter
        userTeams={[]}
        selectedTeams={[]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when userTeams has only one value", () => {
    const { container } = render(
      <ReportsTableTeamFilter
        userTeams={[mockTeams[0]]}
        selectedTeams={[]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders team tags when userTeams has multiple values", () => {
    render(
      <ReportsTableTeamFilter
        userTeams={mockTeams}
        selectedTeams={[]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    expect(screen.getByText("Par équipe :")).toBeInTheDocument();
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    expect(screen.getByText("Team Beta")).toBeInTheDocument();
  });

  it("adds team to filter when clicking unselected tag", () => {
    render(
      <ReportsTableTeamFilter
        userTeams={mockTeams}
        selectedTeams={[]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    fireEvent.click(screen.getByText("Team Alpha"));

    expect(mockOnTeamFilterChange).toHaveBeenCalledWith(["team-1"]);
  });

  it("removes team from filter when clicking selected tag", () => {
    render(
      <ReportsTableTeamFilter
        userTeams={mockTeams}
        selectedTeams={["team-1", "team-2"]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    fireEvent.click(screen.getByText("Team Alpha"));

    expect(mockOnTeamFilterChange).toHaveBeenCalledWith(["team-2"]);
  });

  it("keeps a stable alphabetical order regardless of selection", () => {
    // Gex avant Oyonnax alphabétiquement ; on sélectionne Oyonnax (le 2e)
    const orderedTeams = [
      createMockReportTeam({ id: MOCK_IDS.TEAM_1, name: "Gex" }),
      createMockReportTeam({ id: MOCK_IDS.TEAM_2, name: "Oyonnax" }),
    ];

    const { rerender } = render(
      <ReportsTableTeamFilter
        userTeams={orderedTeams}
        selectedTeams={[]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    function getTeamOrder() {
      return screen
        .getAllByRole("button")
        .map((el) => el.textContent)
        .filter((text) => text === "Gex" || text === "Oyonnax");
    }

    expect(getTeamOrder()).toEqual(["Gex", "Oyonnax"]);

    // La sélection ne doit pas remonter l'équipe sélectionnée en tête
    rerender(
      <ReportsTableTeamFilter
        userTeams={orderedTeams}
        selectedTeams={[MOCK_IDS.TEAM_2]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    expect(getTeamOrder()).toEqual(["Gex", "Oyonnax"]);
  });

  it("shows reset button when teams are selected", () => {
    render(
      <ReportsTableTeamFilter
        userTeams={mockTeams}
        selectedTeams={["team-1"]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    expect(screen.getByText("Réinitialiser les filtres")).toBeInTheDocument();
  });

  it("does not show reset button when no teams selected", () => {
    render(
      <ReportsTableTeamFilter
        userTeams={mockTeams}
        selectedTeams={[]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    expect(
      screen.queryByText("Réinitialiser les filtres"),
    ).not.toBeInTheDocument();
  });

  it("resets all team filters when clicking reset button", () => {
    render(
      <ReportsTableTeamFilter
        userTeams={mockTeams}
        selectedTeams={["team-1", "team-2"]}
        onTeamFilterChange={mockOnTeamFilterChange}
      />,
    );

    fireEvent.click(screen.getByText("Réinitialiser les filtres"));

    expect(mockOnTeamFilterChange).toHaveBeenCalledWith([]);
  });
});
