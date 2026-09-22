import { render, screen } from "@testing-library/react";
import { ReportStatusBadge } from "./request-status-badge";
import { ReportStatus } from "@/generated/prisma/client";

describe("ReportStatusBadge", () => {
  it("renders badge with status", () => {
    render(<ReportStatusBadge status={ReportStatus.PENDING_ASSIGNMENT} />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute(
      "data-status",
      ReportStatus.PENDING_ASSIGNMENT,
    );
  });

  it("renders null when status is undefined", () => {
    const { container } = render(<ReportStatusBadge status={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies whitespace-nowrap className to prevent text wrapping", () => {
    render(<ReportStatusBadge status={ReportStatus.PENDING_ASSIGNMENT} />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveClass("whitespace-nowrap");
  });

  it("applies correct colors for each status", () => {
    const { rerender } = render(
      <ReportStatusBadge status={ReportStatus.PENDING_ASSIGNMENT} />,
    );
    let badge = screen.getByTestId("status-badge");
    expect(badge).toHaveStyle({
      backgroundColor: "#FEE7FC",
      color: "#6E445A",
    });

    rerender(<ReportStatusBadge status={ReportStatus.IN_TREATMENT} />);
    badge = screen.getByTestId("status-badge");
    expect(badge).toHaveStyle({
      backgroundColor: "#FEEBD0",
      color: "#695240",
    });

    rerender(<ReportStatusBadge status={ReportStatus.COMPLETED} />);
    badge = screen.getByTestId("status-badge");
    expect(badge).toHaveStyle({
      backgroundColor: "#C3FAD5",
      color: "#297254",
    });

    rerender(<ReportStatusBadge status={ReportStatus.CLOSED} />);
    badge = screen.getByTestId("status-badge");
    expect(badge).toHaveStyle({
      backgroundColor: "#E9EDFE",
      color: "#2F4077",
    });
  });

  it("renders correct label for each status", () => {
    const { rerender } = render(
      <ReportStatusBadge status={ReportStatus.PENDING_ASSIGNMENT} />,
    );
    expect(
      screen.getByText("En attente de prise en charge"),
    ).toBeInTheDocument();

    rerender(<ReportStatusBadge status={ReportStatus.IN_TREATMENT} />);
    expect(screen.getByText("En cours de traitement")).toBeInTheDocument();

    rerender(<ReportStatusBadge status={ReportStatus.COMPLETED} />);
    expect(screen.getByText("Traité")).toBeInTheDocument();

    rerender(<ReportStatusBadge status={ReportStatus.CLOSED} />);
    expect(screen.getByText("Fermé")).toBeInTheDocument();
  });
});
