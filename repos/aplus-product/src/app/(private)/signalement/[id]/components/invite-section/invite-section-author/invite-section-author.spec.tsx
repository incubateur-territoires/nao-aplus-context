import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthorInviteSection } from "./invite-section-author";
import {
  ReportStatus,
  OrganizationRole,
  TeamType,
} from "@/generated/prisma/client";
import { inferRouterOutputs } from "@trpc/server/unstable-core-do-not-import";
import { AppRouter } from "@/trpc/routers/_app";
import { createMockReportTeam, MOCK_DATES, USER_ROLES } from "@/test/mocks";

const mockReport: inferRouterOutputs<AppRouter>["report"]["getReportById"] = {
  id: "report-1",
  firstName: "John",
  lastName: "Doe",
  birthDate: new Date("1990-01-01").toISOString(),
  phone: "0123456789",
  nir: null,
  caf: null,
  nif: null,
  maritalName: null,
  status: ReportStatus.PENDING_ASSIGNMENT,
  areaId: "area-1",
  subject: "Test Subject",
  description: "Test Description",
  citizenPermissionConfirmed: true,
  authorId: "author-1",
  organizationId: null,
  userId: "user-1",
  author: {
    id: "author-1",
    firstName: "Author",
    lastName: "Name",
    email: "author@example.com",
    name: "Author Name",
    phone: "0123456789",
    profession: "Developer",
    emailVerified: true,
    role: USER_ROLES.USER,
    isInactive: null,
    cguAcceptedAt: null,
    lastActivityAt: new Date(),
    inactivityWarningsSentAt: [],
    notificationFrequency: "EACH_SOLICITATION" as const,
    lastDigestSentAt: null,
    newsLetterAcceptedAt: null,
    internalSupportComment: null,
    deletedAt: null,
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    notificationsViewedBefore: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  applicantTeam: {
    ...createMockReportTeam({
      id: "team-1",
      name: "Test Team",
      organizationId: "org-1",
      role: OrganizationRole.OPERATOR,
    }),
    organization: {
      id: "org-1",
      name: "Organization 1",
      shortName: "ORG1",
      id_v1: "org-1-v1",
      additionalInformation: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: OrganizationRole.OPERATOR,
      type: TeamType.OPERATOR,
    },
  },
  applicantTeamId: "team-1",
  coAuthors: [],
  requestedTeams: [],
  area: {
    id: "area-1",
    name: "Area 1",
    inseeCode: "12345",
    timezone: "Europe/Paris",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  files: [],
  answers: [],
  statusHistory: [],
  createdAt: MOCK_DATES.JAN_1_2024,
  updatedAt: MOCK_DATES.JAN_1_2024,
  lastAnswerAt: null,
  overdueAt: null,
};

const mockColleagues = [
  {
    id: "colleague-1",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    name: "Jane Smith",
    emailVerified: true,
    role: USER_ROLES.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "report-1" }),
}));

const mockMutateAsync = jest.fn().mockResolvedValue({});
const mockInvalidateQueries = jest.fn();

const mockUseTRPC = jest.fn(() => ({
  report: {
    getReportById: {
      queryOptions: (id: string) => ({
        queryKey: ["report", "getReportById", id],
        queryFn: async () => mockReport,
      }),
    },
    addCoAuthorsToReport: {
      mutationOptions: (options?: {
        onSuccess?: () => void;
        onError?: () => void;
      }) => ({
        mutationFn: mockMutateAsync,
        ...options,
      }),
    },
    addRequestedTeamsToReport: {
      mutationOptions: (options?: {
        onSuccess?: () => void;
        onError?: () => void;
      }) => ({
        mutationFn: mockMutateAsync,
        ...options,
      }),
    },
  },
  user: {
    getCurrentUser: {
      queryOptions: () => ({
        queryKey: ["user", "getCurrentUser"],
        queryFn: async () => ({
          id: "user-1",
          firstName: "Author",
          lastName: "Name",
          email: "author@example.com",
          name: "Author Name",
          phone: "0123456789",
          profession: "Developer",
          emailVerified: true,
          role: USER_ROLES.USER,
          createdAt: new Date(),
          updatedAt: new Date(),
          teams: [],
        }),
      }),
    },
  },
  team: {
    getColleaguesByTeamId: {
      queryOptions: (teamId: string) => ({
        queryKey: ["team", "getColleaguesByTeamId", teamId],
        queryFn: async () => mockColleagues,
      }),
    },
    getActiveTeamsByAreaIds: {
      queryOptions: () => ({
        queryKey: ["teams"],
        queryFn: async () => [],
      }),
    },
    getActiveOperatorTeamsByAreaIds: {
      queryOptions: (areaIds: string[]) => {
        const mockTeams = [
          {
            id: "team-1",
            name: "Test Team",
            organizationId: "org-1",
            organization: {
              id: "org-1",
              name: "Organization 1",
              shortName: "ORG1",
              type: TeamType.OPERATOR,
              tags: [{ id: "tag-1", name: "Tag 1" }],
              specificFields: [],
              additionalInformation: null,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
        return {
          queryKey: ["team", "getActiveOperatorTeamsByAreaIds", areaIds],
          queryFn: async () => {
            // Return empty array if no areaIds, otherwise return mock data
            if (!areaIds || areaIds.length === 0) {
              return [];
            }
            return mockTeams;
          },
        };
      },
    },
    getNotInvitedTeamsByReportId: {
      queryOptions: () => ({
        queryKey: ["notInvitedTeams"],
        queryFn: async () => [
          {
            id: "team-1",
            name: "Test Team",
            organizationId: "org-1",
            organization: {
              id: "org-1",
              name: "Organization 1",
              shortName: "ORG1",
              type: TeamType.OPERATOR,
              tags: [{ id: "tag-1", name: "Tag 1" }],
              specificFields: [],
              additionalInformation: null,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }),
    },
  },
  area: {
    getActiveAreas: {
      queryOptions: () => ({
        queryKey: ["areas"],
        queryFn: async () => [
          {
            id: "area-1",
            name: "Area 1",
            inseeCode: "12345",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }),
    },
  },
  answer: {
    getAnswersWithStatusHistory: {
      queryOptions: () => ({
        queryKey: ["answer", "getAnswersWithStatusHistory"],
        queryFn: jest.fn(),
      }),
    },
  },
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => mockUseTRPC(),
}));

jest.mock(
  "../../answer-section/render-choice/render-choice-form/use-create-answer",
  () => ({
    useCreateAnswer: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
  }),
);

jest.mock("@/app/hooks/use-scroll-to-last-message", () => ({
  useScrollToLastMessage: () => ({
    scrollToLastMessage: jest.fn(),
  }),
}));

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        firstName: "Author",
        lastName: "Name",
        email: "author@example.com",
      },
    },
    isPending: false,
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  useMutation: (options: {
    mutationFn?: () => Promise<unknown>;
    onSuccess?: () => void;
    onError?: () => void;
  }) => ({
    mutateAsync: async (...args: unknown[]) => {
      const result = await (options?.mutationFn || mockMutateAsync)(...args);
      if (options?.onSuccess) {
        options.onSuccess();
      }
      return result;
    },
    isPending: false,
  }),
}));

function TestWrapper({
  children,
  initialReport,
}: {
  children: React.ReactNode;
  initialReport?: typeof mockReport;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        refetchOnMount: false,
      },
    },
  });

  // Pre-populate the query cache to ensure report is available immediately
  if (initialReport) {
    queryClient.setQueryData(
      ["report", "getReportById", "report-1"],
      initialReport,
    );
  } else {
    queryClient.setQueryData(
      ["report", "getReportById", "report-1"],
      mockReport,
    );
  }

  // Pre-populate areas query
  queryClient.setQueryData(
    ["areas"],
    [
      {
        id: "area-1",
        name: "Area 1",
        inseeCode: "12345",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  );

  // Don't pre-populate operator teams - let the mock queryFn handle it
  // This ensures the queryFn is always called and returns the correct structure

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
describe("InviteSectionHelper", () => {
  it("renders loading state initially", () => {
    render(
      <TestWrapper>
        <AuthorInviteSection initialReport={mockReport} />
      </TestWrapper>,
    );

    // The component should show loading state briefly
    // Since we're using initialData, it should render quickly
  });

  it("renders invite section header", async () => {
    render(
      <TestWrapper>
        <AuthorInviteSection initialReport={mockReport} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Inviter d'autres/i)).toBeInTheDocument();
    });
  });

  it("renders InviteColleague when colleagues option is selected", async () => {
    render(
      <TestWrapper>
        <AuthorInviteSection initialReport={mockReport} />
      </TestWrapper>,
    );

    // Wait for colleagues query to complete
    await waitFor(() => {
      expect(
        screen.getByLabelText(/Inviter des membres de l'équipe/i),
      ).toBeInTheDocument();
    });

    // Click the colleagues radio button to trigger InviteColleague render
    const colleaguesOption = screen.getByLabelText(
      /Inviter des membres de l'équipe/i,
    );
    colleaguesOption.click();

    // Now InviteColleague should render
    await waitFor(() => {
      expect(
        screen.getByText(/Sélectionnez les membres de l'équipe/i),
      ).toBeInTheDocument();
    });
  });

  it("renders InviteGroups when organizations option is selected", async () => {
    render(
      <TestWrapper>
        <AuthorInviteSection initialReport={mockReport} />
      </TestWrapper>,
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText(/Inviter d'autres/i)).toBeInTheDocument();
    });

    // Select organizations option by finding the radio input with value ORGANIZATIONS
    const orgOption = await waitFor(() =>
      screen.getByDisplayValue("ORGANIZATIONS"),
    );
    orgOption.click();

    // Wait for InviteGroups to render - it shows either teams or empty state
    await waitFor(() => {
      expect(screen.getByText(/Aucun organisme trouvé/i)).toBeInTheDocument();
    });
  });

  it("shows correct header when colleagues are available", async () => {
    render(
      <TestWrapper>
        <AuthorInviteSection initialReport={mockReport} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Inviter d'autres utilisateurs/i),
      ).toBeInTheDocument();
    });
  });

  it("renders with correct structure and styling", async () => {
    render(
      <TestWrapper>
        <AuthorInviteSection initialReport={mockReport} />
      </TestWrapper>,
    );

    await waitFor(() => {
      const container = screen
        .getByText(/Inviter d'autres/i)
        .closest(".bg-white");
      expect(container).toHaveClass("bg-white", "p-20", "flex", "flex-col");
    });
  });

  it("returns null when report status is COMPLETED", async () => {
    const completedReport = { ...mockReport, status: ReportStatus.COMPLETED };
    const { container } = render(
      <TestWrapper initialReport={completedReport}>
        <AuthorInviteSection initialReport={completedReport} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("returns null when report status is CLOSED", async () => {
    const closedReport = { ...mockReport, status: ReportStatus.CLOSED };
    const { container } = render(
      <TestWrapper initialReport={closedReport}>
        <AuthorInviteSection initialReport={closedReport} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
