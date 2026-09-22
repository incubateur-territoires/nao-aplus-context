import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloseSection } from "./close-section";
import {
  OrganizationRole,
  ReportStatus,
  TeamType,
} from "@/generated/prisma/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";
import { useTRPC } from "@/trpc/client";
import { mockTRPC, mockQueryClient } from "@/test/utils/global-mocks";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "request-123" }),
}));

const mockUseSession = jest.fn();
jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

// Mock the mutation hook
const mockMutateAsync = jest.fn();
let mockIsPending = false;

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useQueryClient: jest.fn(),
  };
});

const mockRequest = {
  id: "request-123",
  status: ReportStatus.PENDING_ASSIGNMENT,
  caf: null,
  nir: null,
  nif: null,
  maritalName: null,
  subject: "Test Subject",
  description: "Test Description",
  phone: null,
  firstName: "John",
  lastName: "Doe",
  birthDate: "1990-01-01",
  citizenPermissionConfirmed: true,
  organizationId: "structure-1",
  applicantTeamId: "group-1",
  areaId: "area-1",
  authorId: "author-1",
  userId: null,
  coAuthorsId: [],
  coAuthors: [],
  requestedTeams: [],
  area: {
    id: "area-1",
    name: "Test Area",
    inseeCode: "12345",
    timezone: "Europe/Paris",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  applicantTeam: {
    ...createMockReportTeam({
      id: "group-1",
      name: "Test Group",
      organizationId: "structure-1",
      role: OrganizationRole.OPERATOR,
    }),
    organization: {
      role: OrganizationRole.OPERATOR,
      type: TeamType.OPERATOR,
      id: "structure-1",
      name: "Test Structure",
      shortName: "TS",
      id_v1: "v1",
      additionalInformation: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  files: [],
  answers: [],
  statusHistory: [],
  author: {
    id: "author-1",
    phone: "0123456789",
    profession: "Developer",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    name: "John Doe",
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
  createdAt: new Date(),
  updatedAt: new Date(),
  lastAnswerAt: null,
  overdueAt: null,
};

describe("CloseSection", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const renderWithProvider = (component: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockClear();
    mockIsPending = false;
    mockQueryClient.invalidateQueries.mockClear();

    // User must be the author (id matches authorId) to see the close section
    mockUseSession.mockReturnValue({
      data: { user: { id: "author-1", role: USER_ROLES.USER } },
      isPending: false,
    });

    (useTRPC as jest.Mock).mockReturnValue({
      ...mockTRPC,
      report: {
        ...mockTRPC.report,
        updateReportStatus: {
          mutationOptions: (options?: { onSuccess?: () => void }) => ({
            mutationKey: ["report", "updateStatus"],
            onSuccess: options?.onSuccess,
          }),
        },
      },
    });
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);

    (useMutation as jest.Mock).mockImplementation((mutationOptions) => {
      return {
        mutateAsync: mockMutateAsync.mockImplementation(async () => {
          if (mutationOptions?.onSuccess) {
            mutationOptions.onSuccess();
          }
          return Promise.resolve({});
        }),
        get isPending() {
          return mockIsPending;
        },
      };
    });

    (useQuery as jest.Mock).mockImplementation((queryOptions) => {
      // If initialData is provided, use it (this is what the component does)
      if (
        queryOptions &&
        typeof queryOptions === "object" &&
        "initialData" in queryOptions &&
        queryOptions.initialData !== undefined
      ) {
        return {
          data: (queryOptions as { initialData: unknown }).initialData,
        };
      }
      // Otherwise return undefined
      return { data: undefined };
    });
  });

  it("renders close section for COMPLETED request", () => {
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
      coAuthors: [],
    };
    renderWithProvider(<CloseSection initialReport={completedRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Un signalement fermé reste accessible pendant 6 mois/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /6 mois après sa fermeture, le signalement est supprimé/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("disables button when mutation is pending", () => {
    mockIsPending = true;
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };
    renderWithProvider(<CloseSection initialReport={completedRequest} />);

    const closeButton = screen.getByRole("button", {
      name: "Fermer le signalement",
    });
    expect(closeButton).toBeDisabled();
  });

  it("enables button when mutation is not pending", () => {
    mockIsPending = false;
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };
    renderWithProvider(<CloseSection initialReport={completedRequest} />);

    const closeButton = screen.getByRole("button", {
      name: "Fermer le signalement",
    });
    expect(closeButton).not.toBeDisabled();
  });

  it("shows correct button text", () => {
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };
    renderWithProvider(<CloseSection initialReport={completedRequest} />);

    expect(
      screen.getByRole("button", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("does not render for CLOSED status", () => {
    const closedRequest = {
      ...mockRequest,
      status: ReportStatus.CLOSED,
    };
    const { container } = renderWithProvider(
      <CloseSection initialReport={closedRequest} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("calls updateReportStatus with CLOSED status when closing request", async () => {
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };
    renderWithProvider(<CloseSection initialReport={completedRequest} />);

    const closeButton = screen.getByRole("button", {
      name: "Fermer le signalement",
    });
    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "request-123",
        status: ReportStatus.CLOSED,
      });
    });
  });

  it("does not render for CLOSED status with answers", () => {
    const closedRequestWithAnswers = {
      ...mockRequest,
      status: ReportStatus.CLOSED,
      answers: [
        {
          id: "answer-1",
          content: "Test answer",
          createdAt: new Date(),
          updatedAt: new Date(),
          reportId: "request-123",
          authorId: "author-1",
          isOperatorOnly: false,
          isIrrelevant: false,
          hasStandardProcedure: false,
          isMetadataOnly: false,
          files: [],
          statusHistory: [],
          author: mockRequest.author,
        },
      ],
    };
    const { container } = renderWithProvider(
      <CloseSection initialReport={closedRequestWithAnswers} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("does not render for CLOSED status without answers", () => {
    const closedRequestWithoutAnswers = {
      ...mockRequest,
      status: ReportStatus.CLOSED,
      answers: [],
    };
    const { container } = renderWithProvider(
      <CloseSection initialReport={closedRequestWithoutAnswers} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("does not render when user is not the author", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "different-user", role: USER_ROLES.USER } },
      isPending: false,
    });
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };

    const { container } = renderWithProvider(
      <CloseSection initialReport={completedRequest} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders when user is the author", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "author-1", role: USER_ROLES.USER } },
      isPending: false,
    });
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };

    renderWithProvider(<CloseSection initialReport={completedRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("renders for admin who is not the author", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "admin-user", role: USER_ROLES.ADMIN } },
      isPending: false,
    });
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };

    renderWithProvider(<CloseSection initialReport={completedRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("does not render when session is null", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
    });
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };

    const { container } = renderWithProvider(
      <CloseSection initialReport={completedRequest} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("does not render when session is pending", () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
    });
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };

    const { container } = renderWithProvider(
      <CloseSection initialReport={completedRequest} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("does not render when report is null", () => {
    const { container } = renderWithProvider(
      <CloseSection initialReport={null as unknown as typeof mockRequest} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders when user is a co-author", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "co-author-1", role: USER_ROLES.USER } },
      isPending: false,
    });
    const requestWithCoAuthors = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
      coAuthors: [
        {
          id: "co-author-1",
          phone: "0123456789",
          profession: "Developer",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          name: "Jane Doe",
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
          teams: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    renderWithProvider(<CloseSection initialReport={requestWithCoAuthors} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("does not render when user is neither author nor co-author", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "other-user", role: USER_ROLES.USER } },
      isPending: false,
    });
    const requestWithCoAuthors = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
      coAuthors: [
        {
          id: "co-author-1",
          phone: "0123456789",
          profession: "Developer",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          name: "Jane Doe",
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
          teams: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const { container } = renderWithProvider(
      <CloseSection initialReport={requestWithCoAuthors} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("invalidates queries on successful mutation", async () => {
    const completedRequest = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
    };
    renderWithProvider(<CloseSection initialReport={completedRequest} />);

    const closeButton = screen.getByRole("button", {
      name: "Fermer le signalement",
    });
    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(3);
    });
  });
});
