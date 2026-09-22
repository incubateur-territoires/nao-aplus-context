import { render, screen, fireEvent } from "@testing-library/react";
import { ReportsTableStatusFilter } from "./reports-table-status-filter";
import { ReportStatus } from "@/generated/prisma/client";
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

import { createMockFunctions } from "@/test/mocks";

describe("ReportsTableStatusFilter", () => {
  const mockFunctions = createMockFunctions();
  const mockOnStatusFilterChange = mockFunctions.onStatusFilterChange;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when allStatuses is empty", () => {
    const { container } = render(
      <ReportsTableStatusFilter
        allStatuses={[]}
        selectedStatuses={[]}
        onStatusFilterChange={mockOnStatusFilterChange}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when allStatuses has only one value", () => {
    const { container } = render(
      <ReportsTableStatusFilter
        allStatuses={[ReportStatus.PENDING_ASSIGNMENT]}
        selectedStatuses={[]}
        onStatusFilterChange={mockOnStatusFilterChange}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders status tags when allStatuses has multiple values", () => {
    render(
      <ReportsTableStatusFilter
        allStatuses={[
          ReportStatus.PENDING_ASSIGNMENT,
          ReportStatus.IN_TREATMENT,
        ]}
        selectedStatuses={[]}
        onStatusFilterChange={mockOnStatusFilterChange}
      />,
    );

    expect(screen.getByText("Par état :")).toBeInTheDocument();
    expect(
      screen.getByText("En attente de prise en charge"),
    ).toBeInTheDocument();
    expect(screen.getByText("En cours de traitement")).toBeInTheDocument();
  });

  it("adds status to filter when clicking unselected tag", () => {
    render(
      <ReportsTableStatusFilter
        allStatuses={[
          ReportStatus.PENDING_ASSIGNMENT,
          ReportStatus.IN_TREATMENT,
        ]}
        selectedStatuses={[]}
        onStatusFilterChange={mockOnStatusFilterChange}
      />,
    );

    fireEvent.click(screen.getByText("En attente de prise en charge"));

    expect(mockOnStatusFilterChange).toHaveBeenCalledWith([
      ReportStatus.PENDING_ASSIGNMENT,
    ]);
  });

  it("removes status from filter when clicking selected tag", () => {
    render(
      <ReportsTableStatusFilter
        allStatuses={[
          ReportStatus.PENDING_ASSIGNMENT,
          ReportStatus.IN_TREATMENT,
        ]}
        selectedStatuses={[
          ReportStatus.PENDING_ASSIGNMENT,
          ReportStatus.IN_TREATMENT,
        ]}
        onStatusFilterChange={mockOnStatusFilterChange}
      />,
    );

    fireEvent.click(screen.getByText("En attente de prise en charge"));

    expect(mockOnStatusFilterChange).toHaveBeenCalledWith([
      ReportStatus.IN_TREATMENT,
    ]);
  });

  it("shows reset button when statuses are selected", () => {
    render(
      <ReportsTableStatusFilter
        allStatuses={[
          ReportStatus.PENDING_ASSIGNMENT,
          ReportStatus.IN_TREATMENT,
        ]}
        selectedStatuses={[ReportStatus.PENDING_ASSIGNMENT]}
        onStatusFilterChange={mockOnStatusFilterChange}
      />,
    );

    expect(screen.getByText("Réinitialiser les filtres")).toBeInTheDocument();
  });

  it("does not show reset button when no statuses selected", () => {
    render(
      <ReportsTableStatusFilter
        allStatuses={[
          ReportStatus.PENDING_ASSIGNMENT,
          ReportStatus.IN_TREATMENT,
        ]}
        selectedStatuses={[]}
        onStatusFilterChange={mockOnStatusFilterChange}
      />,
    );

    expect(
      screen.queryByText("Réinitialiser les filtres"),
    ).not.toBeInTheDocument();
  });

  it("resets all status filters when clicking reset button", () => {
    render(
      <ReportsTableStatusFilter
        allStatuses={[
          ReportStatus.PENDING_ASSIGNMENT,
          ReportStatus.IN_TREATMENT,
        ]}
        selectedStatuses={[
          ReportStatus.PENDING_ASSIGNMENT,
          ReportStatus.IN_TREATMENT,
        ]}
        onStatusFilterChange={mockOnStatusFilterChange}
      />,
    );

    fireEvent.click(screen.getByText("Réinitialiser les filtres"));

    expect(mockOnStatusFilterChange).toHaveBeenCalledWith([]);
  });
});
