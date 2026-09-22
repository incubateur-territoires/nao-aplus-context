import { renderHook, act } from "@testing-library/react";
import { useReportsTableFilters } from "./use-reports-table-filters";
import { ReportStatus } from "@/generated/prisma/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { createMockReport, createMockReports, MOCK_IDS } from "@/test/mocks";
import { ReportMode } from "@/types/report-mode";

type Report =
  inferRouterOutputs<AppRouter>["report"]["getMyRequestedReportsTable"]["reports"][number];

const mockUserId = MOCK_IDS.USER_1;

// Report 1: Emma Bouchard, PENDING_ASSIGNMENT, team-1, authorId: user-1
// Report 2: Rémi Chevalier, IN_TREATMENT, team-2, authorId: user-2
// Report 3: Jean Dupont, PENDING_ASSIGNMENT, team-1, authorId: user-1
const mockReports: Report[] = [
  ...createMockReports(),
  createMockReport({
    id: MOCK_IDS.REPORT_3,
    firstName: "Jean",
    lastName: "Dupont",
    subject: "Subject 3",
  }),
] as unknown as Report[];

describe("useReportsTableFilters", () => {
  it("returns all reports when no filters are applied", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    expect(result.current.filteredReports).toHaveLength(3);
    expect(result.current.statusFilters).toEqual([]);
    expect(result.current.teamsFilters).toEqual([]);
    expect(result.current.selectedMyReports).toBe(false);
    expect(result.current.searchQuery).toBe("");
  });

  it("filters by status when status filter is applied", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setStatusFilters([ReportStatus.PENDING_ASSIGNMENT]);
    });

    expect(result.current.filteredReports).toHaveLength(2);
    expect(result.current.filteredReports[0].id).toBe("1");
    expect(result.current.filteredReports[1].id).toBe("3");
  });

  it("filters by team when team filter is applied", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setTeamsFilters(["team-1"]);
    });

    expect(result.current.filteredReports).toHaveLength(2);
    expect(result.current.filteredReports[0].id).toBe("1");
    expect(result.current.filteredReports[1].id).toBe("3");
  });

  it("filters by both status and team when both filters are applied", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setStatusFilters([ReportStatus.PENDING_ASSIGNMENT]);
      result.current.setTeamsFilters(["team-1"]);
    });

    expect(result.current.filteredReports).toHaveLength(2);
    expect(result.current.filteredReports[0].id).toBe("1");
    expect(result.current.filteredReports[1].id).toBe("3");
  });

  it("returns empty array when filters match no reports", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setStatusFilters([ReportStatus.COMPLETED]);
      result.current.setTeamsFilters(["team-3"]);
    });

    expect(result.current.filteredReports).toHaveLength(0);
  });

  it("handles multiple status filters", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setStatusFilters([
        ReportStatus.PENDING_ASSIGNMENT,
        ReportStatus.IN_TREATMENT,
      ]);
    });

    expect(result.current.filteredReports).toHaveLength(3);
  });

  it("handles multiple team filters", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setTeamsFilters(["team-1", "team-2"]);
    });

    expect(result.current.filteredReports).toHaveLength(3);
  });

  it("handles clearing filters", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setStatusFilters([ReportStatus.PENDING_ASSIGNMENT]);
      result.current.setTeamsFilters(["team-1"]);
    });

    expect(result.current.filteredReports).toHaveLength(2);

    act(() => {
      result.current.setStatusFilters([]);
      result.current.setTeamsFilters([]);
    });

    expect(result.current.filteredReports).toHaveLength(3);
  });

  it("handles reports without applicantTeam", () => {
    const reportsWithoutTeam = [
      {
        ...mockReports[0],
        applicantTeam: null as unknown as { id: string; name: string },
      },
    ] as unknown as Report[];

    const { result } = renderHook(() =>
      useReportsTableFilters(reportsWithoutTeam, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setTeamsFilters(["team-1"]);
    });

    expect(result.current.filteredReports).toHaveLength(0);
  });

  it("filters by my reports when selectedMyReports is true", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, mockUserId, ReportMode.CREATED),
    );

    act(() => {
      result.current.handleMyReportsToggle();
    });

    expect(result.current.selectedMyReports).toBe(true);
    expect(result.current.filteredReports).toHaveLength(2);
    expect(result.current.filteredReports[0].id).toBe("1");
    expect(result.current.filteredReports[1].id).toBe("3");
  });

  it("returns all reports when selectedMyReports is false", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, mockUserId, ReportMode.CREATED),
    );

    expect(result.current.selectedMyReports).toBe(false);
    expect(result.current.filteredReports).toHaveLength(3);
  });

  it("handles my reports filter with undefined currentUserId", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.handleMyReportsToggle();
    });

    expect(result.current.selectedMyReports).toBe(true);
    expect(result.current.filteredReports).toHaveLength(0);
  });

  it("filters by search query matching subject", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("Subject 1");
    });

    expect(result.current.searchQuery).toBe("Subject 1");
    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe("1");
  });

  it("filters by search query matching firstName", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("Emma");
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe("1");
  });

  it("filters by search query matching lastName", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("Chevalier");
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe("2");
  });

  it("search query is case insensitive", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("emma");
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe("1");
  });

  it("filters by multiple criteria combined", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, mockUserId, ReportMode.CREATED),
    );

    act(() => {
      result.current.setStatusFilters([ReportStatus.PENDING_ASSIGNMENT]);
      result.current.setTeamsFilters(["team-1"]);
      result.current.handleMyReportsToggle();
      result.current.setSearchQuery("Subject 1");
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe("1");
  });

  it("returns empty array when search query matches no reports", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("NonExistent");
    });

    expect(result.current.filteredReports).toHaveLength(0);
  });

  it("handles clearing search query", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("Emma");
    });

    expect(result.current.filteredReports).toHaveLength(1);

    act(() => {
      result.current.setSearchQuery("");
    });

    expect(result.current.filteredReports).toHaveLength(3);
  });

  it("filters by multi-word search query matching full name", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("Emma Bouchard");
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe("1");
  });

  it("filters by multi-word search query with spaces", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("emma   bouchard");
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe("1");
  });

  it("filters by multi-word search query where words match different fields", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("Emma Subject");
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].id).toBe("1");
  });

  it("returns empty array when multi-word query doesn't match all words", () => {
    const { result } = renderHook(() =>
      useReportsTableFilters(mockReports, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setSearchQuery("Emma NonExistent");
    });

    expect(result.current.filteredReports).toHaveLength(0);
  });

  it("includes CLOSED reports by default when no filters are applied", () => {
    const reportsWithClosed = [
      ...mockReports,
      createMockReport({
        id: "4",
        status: ReportStatus.CLOSED,
      }),
    ] as unknown as Report[];

    const { result } = renderHook(() =>
      useReportsTableFilters(reportsWithClosed, undefined, ReportMode.CREATED),
    );

    expect(result.current.filteredReports).toHaveLength(4);
    expect(
      result.current.filteredReports.some(
        (r) => r.status === ReportStatus.CLOSED,
      ),
    ).toBe(true);
  });

  it("shows CLOSED reports when explicitly filtered", () => {
    const reportsWithClosed = [
      ...mockReports,
      createMockReport({
        id: "4",
        status: ReportStatus.CLOSED,
      }),
    ] as unknown as Report[];

    const { result } = renderHook(() =>
      useReportsTableFilters(reportsWithClosed, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setStatusFilters([ReportStatus.CLOSED]);
    });

    expect(result.current.filteredReports).toHaveLength(1);
    expect(result.current.filteredReports[0].status).toBe(ReportStatus.CLOSED);
  });

  it("excludes CLOSED reports when filtering by other statuses", () => {
    const reportsWithClosed = [
      ...mockReports,
      createMockReport({
        id: "4",
        status: ReportStatus.CLOSED,
      }),
    ] as unknown as Report[];

    const { result } = renderHook(() =>
      useReportsTableFilters(reportsWithClosed, undefined, ReportMode.CREATED),
    );

    act(() => {
      result.current.setStatusFilters([ReportStatus.PENDING_ASSIGNMENT]);
    });

    expect(result.current.filteredReports).toHaveLength(2);
    expect(
      result.current.filteredReports.some(
        (r) => r.status === ReportStatus.CLOSED,
      ),
    ).toBe(false);
  });
});
