// Global test mocks for all test files
import type { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import type { AppRouter } from "@/trpc/routers/_app";
import { MOCK_IDS, createMockArea } from "@/test/mocks";
import { OrganizationRole } from "@/generated/prisma/enums";

type TeamCardTeam =
  inferRouterOutputs<AppRouter>["team"]["getMyTeams"]["items"][number];

// Mock TRPC client
export const mockTRPC = {
  area: {
    getActiveAreas: {
      queryOptions: () => ({ queryKey: ["area"] }),
    },
    getMyAreas: {
      queryOptions: () => ({ queryKey: ["area", "getMyAreas"] }),
    },
  },
  team: {
    getActiveTeamsByAreaIds: {
      queryOptions: () => ({ queryKey: ["team"] }),
    },
  },
  user: {
    getUsers: {
      queryOptions: () => ({ queryKey: ["user"] }),
    },
    getCurrentUser: {
      queryOptions: () => ({ queryKey: ["user", "random"] }),
    },
  },
  request: {
    createRequest: {
      mutationOptions: () => ({ mutationKey: ["request", "create"] }),
    },
  },
  report: {
    createReport: {
      mutationOptions: () => ({ mutationKey: ["report", "create"] }),
    },
    updateReportStatus: {
      mutationOptions: () => ({ mutationKey: ["report", "updateStatus"] }),
    },
    getReportById: {
      queryOptions: () => ({ queryKey: ["report", "getById"] }),
    },
    addCoAuthorsToReport: {
      mutationOptions: () => ({ mutationKey: ["report", "addCoAuthors"] }),
    },
    addRequestedTeamsToReport: {
      mutationOptions: () => ({ mutationKey: ["report", "addRequestedTeams"] }),
    },
    getMyCreatedReportsTable: {
      queryOptions: () => ({
        queryKey: ["report", "getMyCreatedReportsTable"],
      }),
    },
    getMyRequestedReportsTable: {
      queryOptions: () => ({
        queryKey: ["report", "getMyRequestedReportsTable"],
      }),
    },
    getRecipientsByReportId: {
      queryOptions: () => ({ queryKey: ["report", "getRecipientsByReportId"] }),
    },
    getColleagues: {
      queryOptions: () => ({ queryKey: ["report", "getColleagues"] }),
    },
    exportCsv: {
      mutationOptions: () => ({ mutationKey: ["report", "exportCsv"] }),
    },
  },
  contact: {
    send: {
      mutationOptions: () => ({ mutationKey: ["contact", "send"] }),
    },
  },
  file: {
    uploadFiles: {
      mutationOptions: () => ({ mutationKey: ["file", "upload"] }),
    },
  },
  answer: {
    createAnswer: {
      mutationOptions: () => ({ mutationKey: ["answer", "create"] }),
    },
    getAnswersWithStatusHistory: {
      queryOptions: () => ({
        queryKey: ["answer", "getAnswersWithStatusHistory"],
      }),
    },
    getUnreadCountsByReports: {
      queryOptions: () => ({
        queryKey: ["answer", "getUnreadCountsByReports"],
      }),
    },
    markAnswerAsViewed: {
      mutationOptions: () => ({
        mutationKey: ["answer", "markAnswerAsViewed"],
      }),
    },
    markAnswersAsViewed: {
      mutationOptions: () => ({
        mutationKey: ["answer", "markAnswersAsViewed"],
      }),
    },
    markStatusChangeAsViewed: {
      mutationOptions: () => ({
        mutationKey: ["answer", "markStatusChangeAsViewed"],
      }),
    },
    markReportAsViewed: {
      mutationOptions: () => ({
        mutationKey: ["answer", "markReportAsViewed"],
      }),
    },
  },
};

// Mock useQuery
export const mockUseQuery = jest.fn().mockImplementation((options) => {
  const queryKey = JSON.stringify(options.queryKey);

  if (queryKey.includes("user")) {
    if (queryKey.includes("random")) {
      return {
        data: {
          id: "user1",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          name: "John Doe",
          emailVerified: true,
          image: null,
          role: ["user"],
          createdAt: new Date(),
          updatedAt: new Date(),
          teams: [
            {
              id: "group1",
              name: "Group 1",
              areas: [
                { id: "area1", name: "Area 1" },
                { id: "area2", name: "Area 2" },
              ],
            },
            {
              id: "group2",
              name: "Group 2",
              areas: [{ id: "area1", name: "Area 1" }],
            },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    return {
      data: [
        {
          id: "user1",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          name: "John Doe",
          emailVerified: true,
          image: null,
          role: ["user"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "user2",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
          name: "Jane Smith",
          emailVerified: true,
          image: null,
          role: ["user"],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      isLoading: false,
      error: null,
    };
  }

  if (queryKey.includes("team")) {
    return {
      data: [
        {
          id: "group1",
          name: "Group 1",
          organization: {
            id: "structure1",
            name: "Structure 1",
            tags: [
              { id: "tag1", name: "Tag 1" },
              { id: "tag2", name: "Tag 2" },
            ],
          },
        },
      ],
      isLoading: false,
      error: null,
    };
  }

  if (queryKey.includes("report")) {
    return {
      data: {
        id: "test-report-id",
        status: "PENDING_ASSIGNMENT",
        subject: "Test Report",
        description: "Test Description",
        answers: [],
        files: [],
      },
      isLoading: false,
      error: null,
    };
  }

  if (queryKey.includes("answer")) {
    return {
      data: [],
      isLoading: false,
      error: null,
    };
  }

  return {
    data: [
      { id: "area1", name: "Area 1", value: "area1", label: "Area 1" },
      { id: "area2", name: "Area 2", value: "area2", label: "Area 2" },
    ],
    isLoading: false,
    error: null,
  };
});

// Mock useMutation
export const mockUseMutation = jest.fn().mockImplementation(() => {
  return {
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  };
});

// Mock useQueryClient
export const mockQueryClient = {
  invalidateQueries: jest.fn(),
  setQueryData: jest.fn(),
  getQueryData: jest.fn(),
};

// Mock useParams
export const mockUseParams = jest.fn(() => ({ id: "test-request-id" }));

// Mock useRouter
export const mockUseRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
}));

// Mock useSearchParams
// Retourne un vrai URLSearchParams (vide) afin d'exposer get/toString/keys,
// utilisés par les hooks qui mémorisent l'état des tableaux dans l'URL.
export const mockUseSearchParams = jest.fn(() => new URLSearchParams());

// Mock usePathname
export const mockUsePathname = jest.fn(() => "/signalement");

// Mock window.scrollTo
export const mockScrollTo = jest.fn();
Object.defineProperty(window, "scrollTo", {
  value: mockScrollTo,
  writable: true,
});

// Mock console methods
export const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock session data for auth-provider
export const mockSession = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    role: "user",
  },
};

export const mockUseSession = jest.fn(() => ({
  data: mockSession,
  isPending: false,
}));

// Factory function for creating mock team card data
export function createMockTeamCard(
  overrides?: Partial<TeamCardTeam>,
): TeamCardTeam {
  return {
    id: MOCK_IDS.TEAM_1,
    name: "FS Arras",
    createdAt: new Date(),
    updatedAt: new Date(),
    role: OrganizationRole.HELPER,
    organizationId: MOCK_IDS.ORG_1,
    registrationNumber: null,
    email: null,
    description: null,
    adminComment: null,
    managers: [{ id: MOCK_IDS.USER_1 }] as TeamCardTeam["managers"],
    organization: {
      id: MOCK_IDS.ORG_1,
      name: "France Services",
      shortName: "FS - France services",
      id_v1: "8021",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: OrganizationRole.HELPER,
      additionalInformation: null,
      specificFields: [],
      tags: [],
      ...overrides?.organization,
    },
    areas: overrides?.areas || [
      {
        ...createMockArea({ id: "area-1", name: "Pas-de-Calais" }),
        inseeCode: "62",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    _count: { users: 4 },
    ...overrides,
  } as TeamCardTeam;
}
