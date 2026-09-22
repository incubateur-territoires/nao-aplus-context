import { renderHook, act } from "@testing-library/react";
import { useInviteSectionAuthor } from "./use-invite-section-author";
import { ReportStatus } from "@/generated/prisma/client";
import { SelectedOptionEnum } from "./types";
import { mockTRPC } from "@/test/utils/global-mocks";
import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@/trpc/routers/_app";

type Report = inferRouterOutputs<AppRouter>["report"]["getReportById"];

const mockUseQuery = jest.fn();
const mockUseParams = jest.fn();

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    ...mockTRPC,
    team: {
      ...mockTRPC.team,
      getColleaguesByTeamId: {
        queryOptions: (teamId: string) => ({
          queryKey: ["team", "getColleaguesByTeamId", teamId],
        }),
      },
    },
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: (options: unknown) => mockUseQuery(options),
}));

jest.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
}));

describe("useInviteSectionHelper", () => {
  const mockReportId = "report-123";
  const mockTeamId = "team-123";

  const createMockReport = (overrides = {}): Report =>
    ({
      id: mockReportId,
      status: ReportStatus.PENDING_ASSIGNMENT,
      applicantTeamId: mockTeamId,
      coAuthors: [],
      requestedTeams: [],
      author: { id: "author-1" },
      area: {
        id: "area-1",
        name: "Test Area",
        createdAt: new Date(),
        updatedAt: new Date(),
        inseeCode: "12345",
      },
      files: [],
      answers: [],
      statusHistory: [],
      applicantTeam: null,
      subject: "Test Subject",
      description: "Test Description",
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      areaId: "area-1",
      authorId: "author-1",
      ...overrides,
    }) as unknown as Report;

  const createMockColleague = (id: string, name: string) => ({
    id,
    firstName: name,
    lastName: "Doe",
    email: `${name.toLowerCase()}@example.com`,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ id: mockReportId });
  });

  it("returns report data from initial report", () => {
    const mockReport = createMockReport();
    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.report).toEqual(mockReport);
  });

  it("filters out already invited colleagues", () => {
    const mockReport = createMockReport({
      coAuthors: [{ id: "colleague-1" }, { id: "colleague-2" }],
    });

    const allColleagues = [
      createMockColleague("colleague-1", "Alice"),
      createMockColleague("colleague-2", "Bob"),
      createMockColleague("colleague-3", "Charlie"),
    ];

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (queryKey?.includes("team")) {
        return { data: allColleagues, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toHaveLength(1);
    expect(result.current.colleaguesToInvite[0].id).toBe("colleague-3");
  });

  it("filters out the author from colleagues to invite", () => {
    const mockReport = createMockReport({
      author: { id: "author-1" },
    });

    const allColleagues = [
      createMockColleague("author-1", "Author"),
      createMockColleague("colleague-1", "Alice"),
    ];

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (queryKey?.includes("team")) {
        return { data: allColleagues, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toHaveLength(1);
    expect(result.current.colleaguesToInvite[0].id).toBe("colleague-1");
    expect(
      result.current.colleaguesToInvite.some((c) => c.id === "author-1"),
    ).toBe(false);
  });

  it("filters out both already invited colleagues and author", () => {
    const mockReport = createMockReport({
      author: { id: "author-1" },
      coAuthors: [{ id: "colleague-1" }],
    });

    const allColleagues = [
      createMockColleague("author-1", "Author"),
      createMockColleague("colleague-1", "Alice"),
      createMockColleague("colleague-2", "Bob"),
      createMockColleague("colleague-3", "Charlie"),
    ];

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (queryKey?.includes("team")) {
        return { data: allColleagues, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toHaveLength(2);
    expect(result.current.colleaguesToInvite.map((c) => c.id)).toEqual([
      "colleague-2",
      "colleague-3",
    ]);
  });

  it("returns empty array when no colleagues are available", () => {
    const mockReport = createMockReport();
    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (options.queryKey?.includes("team")) {
        return { data: [], isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toEqual([]);
    expect(result.current.showColleaguesToInvite).toBe(false);
  });

  it("sets showColleaguesToInvite to true when colleagues are available", () => {
    const mockReport = createMockReport();
    const allColleagues = [createMockColleague("colleague-1", "Alice")];

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (queryKey?.includes("team")) {
        return { data: allColleagues, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.showColleaguesToInvite).toBe(true);
  });

  it("sets effectiveSelectedOption to COLLEAGUES when colleagues are available and no option is selected", () => {
    const mockReport = createMockReport();
    const allColleagues = [createMockColleague("colleague-1", "Alice")];

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (queryKey?.includes("team")) {
        return { data: allColleagues, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.effectiveSelectedOption).toBe(
      SelectedOptionEnum.COLLEAGUES,
    );
  });

  it("sets effectiveSelectedOption to null when no colleagues are available and no option is selected", () => {
    const mockReport = createMockReport();
    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (options.queryKey?.includes("team")) {
        return { data: [], isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.effectiveSelectedOption).toBe(null);
  });

  it("uses selectedOption when set, overriding default", () => {
    const mockReport = createMockReport();
    const allColleagues = [createMockColleague("colleague-1", "Alice")];

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (queryKey?.includes("team")) {
        return { data: allColleagues, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    act(() => {
      result.current.setSelectedOption(SelectedOptionEnum.ORGANIZATIONS);
    });

    expect(result.current.selectedOption).toBe(
      SelectedOptionEnum.ORGANIZATIONS,
    );
    expect(result.current.effectiveSelectedOption).toBe(
      SelectedOptionEnum.ORGANIZATIONS,
    );
  });

  it("calculates alreadyLinkedRequestedTeamsIds correctly", () => {
    const mockReport = createMockReport({
      requestedTeams: [{ id: "team-1" }, { id: "team-2" }],
    });

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    // Note: The hook doesn't expose alreadyLinkedRequestedTeamsIds directly,
    // but we can verify it through mergedAlreadyLinkedRequestedTeamsIds
    expect(result.current.mergedAlreadyLinkedRequestedTeamsIds).toContain(
      "team-1",
    );
    expect(result.current.mergedAlreadyLinkedRequestedTeamsIds).toContain(
      "team-2",
    );
  });

  it("merges applicantTeamId with alreadyLinkedRequestedTeamsIds", () => {
    const mockReport = createMockReport({
      applicantTeamId: "applicant-team",
      requestedTeams: [{ id: "team-1" }, { id: "team-2" }],
    });

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.mergedAlreadyLinkedRequestedTeamsIds).toEqual([
      "team-1",
      "team-2",
      "applicant-team",
    ]);
  });

  it("handles empty requestedTeams array", () => {
    const mockReport = createMockReport({
      applicantTeamId: "applicant-team",
      requestedTeams: [],
    });

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.mergedAlreadyLinkedRequestedTeamsIds).toEqual([
      "applicant-team",
    ]);
  });

  it("handles missing applicantTeamId", () => {
    const mockReport = createMockReport({
      applicantTeamId: null,
      requestedTeams: [{ id: "team-1" }],
    });

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.mergedAlreadyLinkedRequestedTeamsIds).toEqual([
      "team-1",
      "",
    ]);
  });

  it("sets isClosed to true when report status is CLOSED", () => {
    const mockReport = createMockReport({
      status: ReportStatus.CLOSED,
    });

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.isClosed).toBe(true);
  });

  it("sets isClosed to false when report status is not CLOSED", () => {
    const mockReport = createMockReport({
      status: ReportStatus.PENDING_ASSIGNMENT,
    });

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.isClosed).toBe(false);
  });

  it("does not fetch colleagues when report is closed", () => {
    const mockReport = createMockReport({
      status: ReportStatus.CLOSED,
    });

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (options.queryKey?.includes("team")) {
        // This should not be called when report is closed
        return { data: undefined, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toEqual([]);
    expect(result.current.showColleaguesToInvite).toBe(false);
  });

  it("does not fetch colleagues when applicantTeamId is missing", () => {
    const mockReport = createMockReport({
      applicantTeamId: null,
    });

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (options.queryKey?.includes("team")) {
        // This should not be called when applicantTeamId is missing
        return { data: undefined, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toEqual([]);
    expect(result.current.showColleaguesToInvite).toBe(false);
  });

  it("returns isLoading state from colleagues query", () => {
    const mockReport = createMockReport();
    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (options.queryKey?.includes("team")) {
        return { data: undefined, isLoading: true };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("handles null colleagues array gracefully", () => {
    const mockReport = createMockReport();
    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (options.queryKey?.includes("team")) {
        return { data: null, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toEqual([]);
    expect(result.current.showColleaguesToInvite).toBe(false);
  });

  it("handles missing author gracefully", () => {
    const mockReport = createMockReport({
      author: null,
    });

    const allColleagues = [
      createMockColleague("colleague-1", "Alice"),
      createMockColleague("colleague-2", "Bob"),
    ];

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (queryKey?.includes("team")) {
        return { data: allColleagues, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toHaveLength(2);
  });

  it("handles missing colleagues array gracefully", () => {
    const mockReport = createMockReport({
      coAuthors: null,
    });

    const allColleagues = [createMockColleague("colleague-1", "Alice")];

    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey?.includes("report")) {
        return { data: mockReport, isLoading: false };
      }
      if (queryKey?.includes("team")) {
        return { data: allColleagues, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });

    const { result } = renderHook(() =>
      useInviteSectionAuthor({ initialReport: mockReport }),
    );

    expect(result.current.colleaguesToInvite).toHaveLength(1);
  });
});
