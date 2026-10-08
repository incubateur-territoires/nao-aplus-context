import { render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { AnonymizedReportPage } from "@/types/anonymized-report";
import { AnonymizedReports } from "./anonymized-reports";

jest.mock("@/trpc/client", () => ({ useTRPC: jest.fn() }));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

jest.mock("../anonymized-report-detail/anonymized-report-detail", () => ({
  AnonymizedReportDetail: ({ id }: { id: string }) => <p>Détail {id}</p>,
}));

const PAGE: AnonymizedReportPage = {
  total: 2,
  pageSize: 20,
  items: [
    {
      id: "report-1",
      createdAt: new Date("2026-01-15T10:00:00.000Z"),
      subject: "Premier",
      procedureLabel: null,
      blockageLabel: null,
    },
    {
      id: "report-2",
      createdAt: new Date("2026-01-14T10:00:00.000Z"),
      subject: "Second",
      procedureLabel: null,
      blockageLabel: null,
    },
  ],
};

function setup(data: AnonymizedReportPage | undefined) {
  const queryOptions = jest.fn().mockReturnValue({});
  (useTRPC as jest.Mock).mockReturnValue({
    anonymizedReport: { list: { queryOptions } },
  });
  (useQuery as jest.Mock).mockReturnValue({ data, error: null });
  return { queryOptions };
}

describe("AnonymizedReports", () => {
  it("queries the list without the selection", () => {
    const { queryOptions } = setup(PAGE);
    render(
      <AnonymizedReports
        search={{
          page: 2,
          blockageLabel: "dette",
          id: "report-2",
        }}
        operators={[]}
      />,
    );

    expect(queryOptions).toHaveBeenCalledWith({
      page: 2,
      blockageLabel: "dette",
    });
  });

  it("shows the first report of the page when none is selected", () => {
    setup(PAGE);
    render(<AnonymizedReports search={{ page: 1 }} operators={[]} />);

    expect(screen.getByText("Détail report-1")).toBeInTheDocument();
  });

  it("shows the selected report", () => {
    setup(PAGE);
    render(
      <AnonymizedReports search={{ page: 1, id: "report-2" }} operators={[]} />,
    );

    expect(screen.getByText("Détail report-2")).toBeInTheDocument();
  });

  it("shows no detail on an empty page", () => {
    setup({ total: 0, pageSize: 20, items: [] });
    render(<AnonymizedReports search={{ page: 1 }} operators={[]} />);

    expect(
      screen.getByText("Aucun signalement anonymisé ne correspond."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Détail/)).not.toBeInTheDocument();
  });
});
