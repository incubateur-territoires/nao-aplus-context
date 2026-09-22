import { getReportsTableColumns } from "./reports-table-columns";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { render } from "@testing-library/react";
import type {
  CellContext,
  ColumnDef,
  HeaderContext,
} from "@tanstack/react-table";
import { createMockReport } from "@/test/mocks";
import { ReportStatus } from "@/generated/prisma/enums";

type Report =
  inferRouterOutputs<AppRouter>["report"]["getMyCreatedReportsTable"]["reports"][number];

function makeCellContext(report: Report): CellContext<Report, unknown> {
  return {
    row: { original: report, id: "1", index: 0 },
    getValue: () => "",
    column: {} as CellContext<Report, unknown>["column"],
    renderValue: () => "",
    cell: {} as CellContext<Report, unknown>["cell"],
    table: {} as CellContext<Report, unknown>["table"],
  } as CellContext<Report, unknown>;
}

function getColumn(
  columns: ColumnDef<Report>[],
  id: string,
): ColumnDef<Report> {
  const col = columns.find((c) => c.id === id);
  if (!col) throw new Error(`Column ${id} not found`);
  return col;
}

describe("getReportsTableColumns", () => {
  const mockReport = createMockReport({
    firstName: "John",
    lastName: "Doe",
    subject: "Test subject",
  });

  it("returns array of column definitions", () => {
    const columns = getReportsTableColumns();
    expect(Array.isArray(columns)).toBe(true);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("includes citizen-subject column", () => {
    const columns = getReportsTableColumns();
    const citizenColumn = columns.find((col) => col.id === "citizen-subject");
    expect(citizenColumn).toBeDefined();
    expect(citizenColumn?.enableSorting).toBe(true);
  });

  it("includes author column", () => {
    const columns = getReportsTableColumns();
    const authorColumn = columns.find((col) => col.id === "author");
    expect(authorColumn).toBeDefined();
    expect(authorColumn?.enableSorting).toBe(true);
  });

  it("does not include a separate status column", () => {
    const columns = getReportsTableColumns();
    const statusColumn = columns.find((col) => col.id === "status");
    expect(statusColumn).toBeUndefined();
  });

  it("includes createdAt column", () => {
    const columns = getReportsTableColumns();
    const createdAtColumn = columns.find((col) => col.id === "createdAt");
    expect(createdAtColumn).toBeDefined();
    if (createdAtColumn && "accessorKey" in createdAtColumn) {
      expect(createdAtColumn.accessorKey).toBe("createdAt");
    }
    expect(createdAtColumn?.enableSorting).toBe(true);
  });

  it("includes lastMessage column", () => {
    const columns = getReportsTableColumns();
    const lastMessageColumn = columns.find((col) => col.id === "lastMessage");
    expect(lastMessageColumn).toBeDefined();
    expect(lastMessageColumn?.enableSorting).toBe(true);
  });

  it("includes actions column", () => {
    const columns = getReportsTableColumns();
    const actionsColumn = columns.find((col) => col.id === "actions");
    expect(actionsColumn).toBeDefined();
    expect(actionsColumn?.enableSorting).toBe(false);
  });

  it("citizen-subject accessorFn returns full name", () => {
    const columns = getReportsTableColumns();
    const citizenColumn = columns.find((col) => col.id === "citizen-subject");

    expect(citizenColumn).toBeDefined();
    if (citizenColumn && "accessorFn" in citizenColumn) {
      const result = citizenColumn.accessorFn(mockReport, 0);
      expect(result).toBe("Doe John");
    }
  });

  it("highlights search query in firstName when searchQuery is provided", () => {
    const columns = getReportsTableColumns("John");
    const citizenColumn = columns.find((col) => col.id === "citizen-subject");

    expect(citizenColumn).toBeDefined();
    if (
      citizenColumn &&
      "cell" in citizenColumn &&
      typeof citizenColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: mockReport, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<Report, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<Report, unknown>["cell"],
        table: {} as CellContext<Report, unknown>["table"],
      } as CellContext<Report, unknown>;

      const { container } = render(<>{citizenColumn.cell(mockCellContext)}</>);
      const span = container.querySelector("span");
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe("John");
      expect(span).toHaveStyle({ backgroundColor: "#BFDBFE" });
    }
  });

  it("highlights search query in lastName when searchQuery is provided", () => {
    const columns = getReportsTableColumns("Doe");
    const citizenColumn = columns.find((col) => col.id === "citizen-subject");

    expect(citizenColumn).toBeDefined();
    if (
      citizenColumn &&
      "cell" in citizenColumn &&
      typeof citizenColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: mockReport, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<Report, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<Report, unknown>["cell"],
        table: {} as CellContext<Report, unknown>["table"],
      } as CellContext<Report, unknown>;

      const { container } = render(<>{citizenColumn.cell(mockCellContext)}</>);
      const highlightedSpans = container.querySelectorAll(
        'span[style*="background-color"]',
      );
      expect(highlightedSpans.length).toBeGreaterThan(0);
      expect(
        Array.from(highlightedSpans).some((el) => el.textContent === "Doe"),
      ).toBe(true);
      Array.from(highlightedSpans).forEach((el) => {
        expect(el).toHaveStyle({ backgroundColor: "#BFDBFE" });
      });
    }
  });

  it("highlights search query in subject when searchQuery is provided", () => {
    const columns = getReportsTableColumns("Test");
    const citizenColumn = columns.find((col) => col.id === "citizen-subject");

    expect(citizenColumn).toBeDefined();
    if (
      citizenColumn &&
      "cell" in citizenColumn &&
      typeof citizenColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: mockReport, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<Report, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<Report, unknown>["cell"],
        table: {} as CellContext<Report, unknown>["table"],
      } as CellContext<Report, unknown>;

      const { container } = render(<>{citizenColumn.cell(mockCellContext)}</>);
      const highlightedSpans = container.querySelectorAll(
        'span[style*="background-color"]',
      );
      expect(highlightedSpans.length).toBeGreaterThan(0);
      expect(
        Array.from(highlightedSpans).some((el) => el.textContent === "Test"),
      ).toBe(true);
      Array.from(highlightedSpans).forEach((el) => {
        expect(el).toHaveStyle({ backgroundColor: "#BFDBFE" });
      });
    }
  });

  it("does not highlight when searchQuery is empty", () => {
    const columns = getReportsTableColumns();
    const citizenColumn = columns.find((col) => col.id === "citizen-subject");

    expect(citizenColumn).toBeDefined();
    if (
      citizenColumn &&
      "cell" in citizenColumn &&
      typeof citizenColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: mockReport, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<Report, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<Report, unknown>["cell"],
        table: {} as CellContext<Report, unknown>["table"],
      } as CellContext<Report, unknown>;

      const { container } = render(<>{citizenColumn.cell(mockCellContext)}</>);
      const span = container.querySelector('span[style*="background-color"]');
      expect(span).not.toBeInTheDocument();
    }
  });

  it("highlights case-insensitively", () => {
    const columns = getReportsTableColumns("john");
    const citizenColumn = columns.find((col) => col.id === "citizen-subject");

    expect(citizenColumn).toBeDefined();
    if (
      citizenColumn &&
      "cell" in citizenColumn &&
      typeof citizenColumn.cell === "function"
    ) {
      const mockCellContext = {
        row: { original: mockReport, id: "1", index: 0 },
        getValue: () => "",
        column: {} as CellContext<Report, unknown>["column"],
        renderValue: () => "",
        cell: {} as CellContext<Report, unknown>["cell"],
        table: {} as CellContext<Report, unknown>["table"],
      } as CellContext<Report, unknown>;

      const { container } = render(<>{citizenColumn.cell(mockCellContext)}</>);
      const span = container.querySelector("span");
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe("John");
      expect(span).toHaveStyle({ backgroundColor: "#BFDBFE" });
    }
  });

  it("citizen-subject header renders citizen name and subject labels", () => {
    const columns = getReportsTableColumns();
    const citizenColumn = getColumn(columns, "citizen-subject");
    if (typeof citizenColumn.header === "function") {
      const { getByText } = render(
        <>
          {
            citizenColumn.header(
              {} as HeaderContext<Report, unknown>,
            ) as React.ReactNode
          }
        </>,
      );
      expect(getByText("Nom du citoyen")).toBeInTheDocument();
      expect(getByText("Sujet du signalement")).toBeInTheDocument();
    }
  });

  it("author header renders author name and team labels", () => {
    const columns = getReportsTableColumns();
    const authorColumn = getColumn(columns, "author");
    if (typeof authorColumn.header === "function") {
      const { getByText } = render(
        <>
          {
            authorColumn.header(
              {} as HeaderContext<Report, unknown>,
            ) as React.ReactNode
          }
        </>,
      );
      expect(getByText("Nom de l’auteur")).toBeInTheDocument();
      expect(getByText("Équipe de l’auteur")).toBeInTheDocument();
    }
  });

  it("author cell shows applicantTeam name without area", () => {
    const report = createMockReport({
      applicantTeam: {
        id: "team-1",
        name: "France Services Oyonnax",
        deletedAt: null,
      },
      area: { id: "area-1", name: "Ain" },
    });
    const columns = getReportsTableColumns();
    const authorColumn = getColumn(columns, "author");
    if (typeof authorColumn.cell === "function") {
      const { getByText, queryByText } = render(
        <>{authorColumn.cell(makeCellContext(report)) as React.ReactNode}</>,
      );
      expect(getByText("France Services Oyonnax")).toBeInTheDocument();
      expect(queryByText(/Ain/)).not.toBeInTheDocument();
    }
  });

  it("author cell shows author full name", () => {
    const report = createMockReport({
      author: { id: "user-1", firstName: "Lucie", lastName: "Grondin" },
    });
    const columns = getReportsTableColumns();
    const authorColumn = getColumn(columns, "author");
    if (typeof authorColumn.cell === "function") {
      const { getByText } = render(
        <>{authorColumn.cell(makeCellContext(report)) as React.ReactNode}</>,
      );
      expect(getByText("Lucie Grondin")).toBeInTheDocument();
    }
  });

  it("author accessorFn returns author full name", () => {
    const report = createMockReport({
      author: { id: "user-1", firstName: "Lucie", lastName: "Grondin" },
    });
    const columns = getReportsTableColumns();
    const authorColumn = getColumn(columns, "author");
    if ("accessorFn" in authorColumn && authorColumn.accessorFn) {
      expect(authorColumn.accessorFn(report, 0)).toBe("Grondin Lucie");
    }
  });

  it("author cell hides location row when applicantTeam and area are missing", () => {
    const report = createMockReport({
      applicantTeam: { id: "", name: "", deletedAt: null },
      area: { id: "", name: "" },
    });
    const columns = getReportsTableColumns();
    const authorColumn = getColumn(columns, "author");
    if (typeof authorColumn.cell === "function") {
      const { container } = render(
        <>{authorColumn.cell(makeCellContext(report)) as React.ReactNode}</>,
      );
      expect(container.querySelector(".ri-map-pin-2-line")).toBeNull();
    }
  });

  it("citizen-subject cell shows unviewed indicator dot when in unviewedReportIds", () => {
    const columns = getReportsTableColumns(
      undefined,
      undefined,
      new Set([mockReport.id]),
    );
    const citizenColumn = getColumn(columns, "citizen-subject");
    if (typeof citizenColumn.cell === "function") {
      const { container } = render(
        <>
          {citizenColumn.cell(makeCellContext(mockReport)) as React.ReactNode}
        </>,
      );
      expect(container).toHaveTextContent("Nouveau signalement");
    }
  });

  it("citizen-subject cell hides unviewed indicator dot when report is closed", () => {
    const report = createMockReport({ status: ReportStatus.CLOSED });
    const columns = getReportsTableColumns(
      undefined,
      undefined,
      new Set([report.id]),
    );
    const citizenColumn = getColumn(columns, "citizen-subject");
    if (typeof citizenColumn.cell === "function") {
      const { container } = render(
        <>{citizenColumn.cell(makeCellContext(report)) as React.ReactNode}</>,
      );
      expect(container).not.toHaveTextContent("Nouveau signalement");
    }
  });

  it("citizen-subject cell renders ReportStatusBadge", () => {
    const report = createMockReport({ status: ReportStatus.IN_TREATMENT });
    const columns = getReportsTableColumns();
    const citizenColumn = getColumn(columns, "citizen-subject");
    if (typeof citizenColumn.cell === "function") {
      const { getByTestId } = render(
        <>{citizenColumn.cell(makeCellContext(report)) as React.ReactNode}</>,
      );
      const badge = getByTestId("status-badge");
      expect(badge).toHaveAttribute("data-status", ReportStatus.IN_TREATMENT);
    }
  });

  it("createdAt cell renders formatted date", () => {
    const report = createMockReport({
      createdAt: new Date("2025-06-24T10:00:00Z"),
    });
    const columns = getReportsTableColumns();
    const createdAtColumn = getColumn(columns, "createdAt");
    if (typeof createdAtColumn.cell === "function") {
      const result = createdAtColumn.cell(
        makeCellContext(report),
      ) as React.ReactNode;
      expect(typeof result).toBe("string");
      expect((result as string).length).toBeGreaterThan(0);
    }
  });

  it("lastMessage cell renders dash when no answers and no updatedAt", () => {
    const report = createMockReport({
      answers: [],
      updatedAt: null as unknown as Date,
    });
    const columns = getReportsTableColumns();
    const lastMessageColumn = getColumn(columns, "lastMessage");
    if (typeof lastMessageColumn.cell === "function") {
      const result = lastMessageColumn.cell(
        makeCellContext(report),
      ) as React.ReactNode;
      const { container } = render(<>{result}</>);
      expect(container.querySelector("span")?.textContent).toBe("-");
    }
  });

  it("lastMessage cell renders formatted date when answer exists", () => {
    const report = createMockReport({
      answers: [
        { createdAt: new Date("2025-06-24T10:00:00Z"), authorId: "user-1" },
      ],
    });
    const columns = getReportsTableColumns();
    const lastMessageColumn = getColumn(columns, "lastMessage");
    if (typeof lastMessageColumn.cell === "function") {
      const result = lastMessageColumn.cell(
        makeCellContext(report),
      ) as React.ReactNode;
      const { container } = render(<>{result}</>);
      const dateText = container.querySelector("span")?.textContent;
      expect(dateText).toBeTruthy();
      expect(dateText).not.toBe("-");
    }
  });

  it("lastMessage accessorFn returns last message date", () => {
    const date = new Date("2025-06-24T10:00:00Z");
    const report = createMockReport({
      answers: [{ createdAt: date, authorId: "user-1" }],
    });
    const columns = getReportsTableColumns();
    const lastMessageColumn = getColumn(columns, "lastMessage");
    if ("accessorFn" in lastMessageColumn && lastMessageColumn.accessorFn) {
      expect(lastMessageColumn.accessorFn(report, 0)).toEqual(date);
    }
  });

  it("unreadCount cell renders count badge when count > 0", () => {
    const columns = getReportsTableColumns(undefined, {
      [mockReport.id]: 3,
    });
    const unreadColumn = getColumn(columns, "unreadCount");
    if (typeof unreadColumn.cell === "function") {
      const { getByText } = render(
        <>
          {unreadColumn.cell(makeCellContext(mockReport)) as React.ReactNode}
        </>,
      );
      expect(getByText("3")).toBeInTheDocument();
    }
  });

  it("unreadCount cell renders nothing when report is closed even with unread messages", () => {
    const closedReport = createMockReport({ status: ReportStatus.CLOSED });
    const columns = getReportsTableColumns(undefined, {
      [closedReport.id]: 3,
    });
    const unreadColumn = getColumn(columns, "unreadCount");
    if (typeof unreadColumn.cell === "function") {
      const result = unreadColumn.cell(
        makeCellContext(closedReport),
      ) as React.ReactNode;
      expect(result).toBeNull();
    }
  });

  it("unreadCount cell renders count badge for a completed report", () => {
    const completedReport = createMockReport({
      status: ReportStatus.COMPLETED,
    });
    const columns = getReportsTableColumns(undefined, {
      [completedReport.id]: 2,
    });
    const unreadColumn = getColumn(columns, "unreadCount");
    if (typeof unreadColumn.cell === "function") {
      const { getByText } = render(
        <>
          {
            unreadColumn.cell(
              makeCellContext(completedReport),
            ) as React.ReactNode
          }
        </>,
      );
      expect(getByText("2")).toBeInTheDocument();
    }
  });

  it("unreadCount cell renders nothing when count is 0", () => {
    const columns = getReportsTableColumns(undefined, {
      [mockReport.id]: 0,
    });
    const unreadColumn = getColumn(columns, "unreadCount");
    if (typeof unreadColumn.cell === "function") {
      const result = unreadColumn.cell(
        makeCellContext(mockReport),
      ) as React.ReactNode;
      expect(result).toBeNull();
    }
  });

  it("unreadCount cell renders nothing when unreadCounts is undefined", () => {
    const columns = getReportsTableColumns();
    const unreadColumn = getColumn(columns, "unreadCount");
    if (typeof unreadColumn.cell === "function") {
      const result = unreadColumn.cell(
        makeCellContext(mockReport),
      ) as React.ReactNode;
      expect(result).toBeNull();
    }
  });

  it("actions cell renders Voir link with report URL", () => {
    const columns = getReportsTableColumns();
    const actionsColumn = getColumn(columns, "actions");
    if (typeof actionsColumn.cell === "function") {
      const { getByRole } = render(
        <>
          {actionsColumn.cell(makeCellContext(mockReport)) as React.ReactNode}
        </>,
      );
      const link = getByRole("link", { name: /voir/i });
      expect(link).toHaveAttribute(
        "href",
        expect.stringContaining(mockReport.id),
      );
    }
  });
});
