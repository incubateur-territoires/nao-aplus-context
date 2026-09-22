import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { AnswerSection } from "./answer-section";
import { ReportStatus } from "@/generated/prisma/client";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import * as reactQuery from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

// Mock useParams
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-request-id" }),
}));

// Mock child components
jest.mock("./action-choice/action-choice", () => ({
  ActionChoice: () => (
    <div data-testid="action-choice">ActionChoice Component</div>
  ),
}));

jest.mock("./answer-list/answer-list", () => ({
  AnswerList: ({
    requestId,
  }: {
    requestId: string;
    initialData: inferRouterOutputs<AppRouter>["answer"]["getAnswersWithStatusHistory"];
  }) => <div data-testid="answer-list">AnswerList Component {requestId}</div>,
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

const mockTrpc = {
  report: {
    getReportById: {
      queryOptions: jest.fn((id: string) => ({
        queryKey: ["report", "getReportById", id],
        queryFn: jest.fn(),
      })),
    },
  },
  answer: {
    getAnswersWithStatusHistory: {
      queryOptions: jest.fn((id: string) => ({
        queryKey: ["answer", "getAnswersWithStatusHistory", id],
        queryFn: jest.fn(),
      })),
    },
  },
};

jest.mock("@/trpc/client", () => ({
  useTRPC: () => mockTrpc,
}));

describe("AnswerSection", () => {
  const baseRequest = {
    id: "1",
    firstName: "Jean",
    profession: "Developer",
    lastName: "Dupont",
    birthDate: "1990-05-15",
    authorId: "author1",
    phone: "0123456789",
    nir: "1901234567890",
    caf: "CAF123456",
    nif: "NIF789012",
    maritalName: null,
    subject: "Test subject",
    description: "Test description",
    createdAt: new Date(),
    updatedAt: new Date(),
    areaId: "area1",
    applicantTeamId: "group1",
    citizenPermissionConfirmed: true,
    organizationId: "struct1",
    author: {
      id: "author1",
      firstName: "Jean",
      lastName: "Dupont",
      phone: "0123456789",
      profession: "Developer",
      email: "jean.dupont@example.com",
      name: "Jean Dupont",
      emailVerified: true,
      role: USER_ROLES.USER,
      isInactive: null,
      deletedAt: null,
      cguAcceptedAt: null,
      lastActivityAt: new Date(),
      inactivityWarningsSentAt: [],
      notificationFrequency: "EACH_SOLICITATION" as const,
      lastDigestSentAt: null,
      newsLetterAcceptedAt: null,
      internalSupportComment: null,
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: false,
      hasViewed: false,
      notificationsViewedBefore: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    files: [],
    area: {
      id: "area1",
      name: "Paris",
      timezone: "Europe/Paris",
      createdAt: new Date(),
      updatedAt: new Date(),
      inseeCode: "75000",
    },
    requestedTeams: [
      {
        ...createMockReportTeam({
          id: "group1",
          name: "CAF",
          organizationId: "struct1",
          role: OrganizationRole.OPERATOR,
        }),
        organization: {
          id: "struct1",
          name: "Structure Test",
          shortName: "ST",
          createdAt: new Date(),
          updatedAt: new Date(),
          id_v1: "struct1_v1",
          additionalInformation: null,
          role: OrganizationRole.OPERATOR,
          type: TeamType.OPERATOR,
          specificFields: [],
        },
      },
    ],
    applicantTeam: {
      ...createMockReportTeam({
        id: "group1",
        name: "Maison France Services",
        organizationId: "struct1",
        role: OrganizationRole.OPERATOR,
      }),
      organization: {
        id: "struct1",
        name: "Structure Test",
        shortName: "ST",
        createdAt: new Date(),
        updatedAt: new Date(),
        id_v1: "struct1_v1",
        additionalInformation: null,
        role: OrganizationRole.OPERATOR,
        type: TeamType.OPERATOR,
      },
    },
    coAuthors: [],
    coAuthorsId: [],
    userId: null,
    lastAnswerAt: null,
    overdueAt: null,
    answers: [],
    statusHistory: [],
  };

  const mockAnswersData = {
    answers: [],
    statusHistory: [],
  };

  const queryClient = new QueryClient();

  const renderWithWrapper = (children: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when request status is PENDING_ASSIGNMENT", () => {
    const waitingRequest = {
      ...baseRequest,
      status: ReportStatus.PENDING_ASSIGNMENT,
    };

    beforeEach(() => {
      (reactQuery.useQuery as jest.Mock).mockReturnValue({
        data: waitingRequest,
        isLoading: false,
        error: null,
      });
    });

    it("renders ActionChoice component", async () => {
      renderWithWrapper(
        <AnswerSection
          initialReport={waitingRequest}
          initialAnswersData={mockAnswersData}
          currentUserId="user-1"
          userTimezone="Europe/Paris"
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("action-choice")).toBeInTheDocument();
      });
    });

    describe("when request status is IN_TREATMENT", () => {
      const inTreatmentRequest = {
        ...baseRequest,
        status: ReportStatus.IN_TREATMENT,
      };

      beforeEach(() => {
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: inTreatmentRequest,
          isLoading: false,
          error: null,
        });
      });

      it("renders both AnswerList and ActionChoice components", async () => {
        renderWithWrapper(
          <AnswerSection
            initialReport={inTreatmentRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          expect(screen.getByTestId("answer-list")).toBeInTheDocument();
          expect(screen.getByTestId("action-choice")).toBeInTheDocument();
        });
      });
    });

    describe("when request status is CLOSED", () => {
      const closedRequest = {
        ...baseRequest,
        status: ReportStatus.CLOSED,
      };

      beforeEach(() => {
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: closedRequest,
          isLoading: false,
          error: null,
        });
      });

      it("renders only AnswerList (no ActionChoice)", async () => {
        renderWithWrapper(
          <AnswerSection
            initialReport={closedRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          expect(screen.getByTestId("answer-list")).toBeInTheDocument();
          expect(screen.queryByTestId("action-choice")).not.toBeInTheDocument();
        });
      });
    });

    describe("when request status is DELETED", () => {
      const deletedRequest = {
        ...baseRequest,
        status: ReportStatus.DELETED,
      };

      beforeEach(() => {
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: deletedRequest,
          isLoading: false,
          error: null,
        });
      });

      it("renders only AnswerList (no ActionChoice)", async () => {
        renderWithWrapper(
          <AnswerSection
            initialReport={deletedRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          expect(screen.getByTestId("answer-list")).toBeInTheDocument();
          expect(screen.queryByTestId("action-choice")).not.toBeInTheDocument();
        });
      });
    });

    describe("when request status is COMPLETED", () => {
      const completedRequest = {
        ...baseRequest,
        status: ReportStatus.COMPLETED,
      };

      it("renders ActionChoice when current user is not author nor co-author", async () => {
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: completedRequest,
          isLoading: false,
          error: null,
        });

        renderWithWrapper(
          <AnswerSection
            initialReport={completedRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          expect(screen.getByTestId("answer-list")).toBeInTheDocument();
          expect(screen.queryByTestId("action-choice")).toBeInTheDocument();
        });
      });

      it("hides ActionChoice when current user is the author", async () => {
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: completedRequest,
          isLoading: false,
          error: null,
        });

        renderWithWrapper(
          <AnswerSection
            initialReport={completedRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="author1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          expect(screen.getByTestId("answer-list")).toBeInTheDocument();
          expect(screen.queryByTestId("action-choice")).not.toBeInTheDocument();
        });
      });

      it("hides ActionChoice when current user is a co-author", async () => {
        const completedWithCoAuthor = {
          ...completedRequest,
          coAuthors: [
            {
              id: "coauthor1",
              firstName: "Co",
              lastName: "Author",
              email: "co@example.com",
              name: "Co Author",
              emailVerified: true,
              phone: null,
              profession: null,
              role: USER_ROLES.USER,
              isInactive: null,
              deletedAt: null,
              cguAcceptedAt: null,
              lastActivityAt: new Date(),
              inactivityWarningsSentAt: [],
              notificationFrequency: "EACH_SOLICITATION" as const,
              lastDigestSentAt: null,
              newsLetterAcceptedAt: null,
              internalSupportComment: null,
              banned: false,
              banReason: null,
              banExpires: null,
              twoFactorEnabled: false,
              hasViewed: false,
              notificationsViewedBefore: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              teams: [],
            },
          ],
        };
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: completedWithCoAuthor,
          isLoading: false,
          error: null,
        });

        renderWithWrapper(
          <AnswerSection
            initialReport={completedWithCoAuthor}
            initialAnswersData={mockAnswersData}
            currentUserId="coauthor1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          expect(screen.getByTestId("answer-list")).toBeInTheDocument();
          expect(screen.queryByTestId("action-choice")).not.toBeInTheDocument();
        });
      });
    });

    describe("query integration", () => {
      const normalRequest = {
        ...baseRequest,
        status: ReportStatus.PENDING_ASSIGNMENT,
      };

      it("uses initial data correctly", async () => {
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: normalRequest,
          isLoading: false,
          error: null,
        });

        renderWithWrapper(
          <AnswerSection
            initialReport={normalRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          expect(reactQuery.useQuery).toHaveBeenCalledWith(
            expect.objectContaining({
              initialData: normalRequest,
            }),
          );
        });
      });

      it("updates when query data changes", async () => {
        const updatedRequest = {
          ...baseRequest,
          status: ReportStatus.IN_TREATMENT,
        };

        // Start with waiting status (no AnswerList)
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: normalRequest,
          isLoading: false,
          error: null,
        });

        const { rerender } = renderWithWrapper(
          <AnswerSection
            initialReport={normalRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          expect(screen.queryByTestId("answer-list")).toBeInTheDocument();
          expect(screen.getByTestId("action-choice")).toBeInTheDocument();
        });

        // Update to in treatment status (shows both AnswerList and ActionChoice)
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: updatedRequest,
          isLoading: false,
          error: null,
        });

        rerender(
          <QueryClientProvider client={queryClient}>
            <AnswerSection
              initialReport={normalRequest}
              initialAnswersData={mockAnswersData}
              currentUserId="user-1"
              userTimezone="Europe/Paris"
            />
          </QueryClientProvider>,
        );

        await waitFor(() => {
          expect(screen.getByTestId("answer-list")).toBeInTheDocument();
          expect(screen.getByTestId("action-choice")).toBeInTheDocument();
        });
      });

      it("handles loading state gracefully", async () => {
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: undefined,
          isLoading: true,
          error: null,
        });

        const { container } = renderWithWrapper(
          <AnswerSection
            initialReport={normalRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        // Should not render AnswerList or ActionChoice when request data is undefined
        await waitFor(() => {
          expect(container.firstChild).toBeInTheDocument();
          expect(screen.queryByTestId("answer-list")).toBeInTheDocument();
          expect(screen.queryByTestId("action-choice")).not.toBeInTheDocument();
        });
      });
    });

    describe("component structure", () => {
      const normalRequest = {
        ...baseRequest,
        status: ReportStatus.IN_TREATMENT,
      };

      beforeEach(() => {
        (reactQuery.useQuery as jest.Mock).mockReturnValue({
          data: normalRequest,
          isLoading: false,
          error: null,
        });
      });

      it("renders with correct container structure", async () => {
        renderWithWrapper(
          <AnswerSection
            initialReport={normalRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          const container = screen.getByTestId("answer-list").parentElement;
          expect(container?.tagName).toBe("DIV");
        });
      });

      it("renders components in correct order", async () => {
        renderWithWrapper(
          <AnswerSection
            initialReport={normalRequest}
            initialAnswersData={mockAnswersData}
            currentUserId="user-1"
            userTimezone="Europe/Paris"
          />,
        );

        await waitFor(() => {
          const container = screen.getByTestId("answer-list").parentElement;
          const children = Array.from(container?.children || []);

          expect(children[0]).toHaveAttribute("data-testid", "answer-list");
          expect(children[1]).toHaveAttribute("data-testid", "action-choice");
        });
      });
    });
  });
});
