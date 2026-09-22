import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloseRequest } from "./close-request";
import {
  ReportStatus,
  OrganizationRole,
  TeamType,
} from "@/generated/prisma/enums";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMockReportTeam,
  createMockAuthor,
  USER_ROLES,
} from "@/test/mocks";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "request-123" }),
}));

const mockUseSession = jest.fn();
jest.mock("@/lib/auth-client", () => ({
  useSession: () => mockUseSession(),
}));
jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    user: {
      getCurrentUser: {
        queryOptions: jest.fn().mockReturnValue({
          queryKey: ["user", "getCurrentUser"],
        }),
      },
    },
    report: {
      getReportById: {
        queryOptions: jest.fn().mockReturnValue({
          queryKey: ["report", "getReportById"],
        }),
      },
      updateReportStatus: {
        mutationOptions: jest.fn().mockReturnValue({}),
      },
    },
    answer: {
      getAnswersWithStatusHistory: {
        queryOptions: jest.fn().mockReturnValue({
          queryKey: ["answer", "getAnswersWithStatusHistory"],
        }),
      },
    },
  }),
}));

// Mock window.scrollTo
const mockScrollTo = jest.fn();
Object.defineProperty(window, "scrollTo", {
  value: mockScrollTo,
  writable: true,
});

// Mock useScrollToLastMessage hook
const mockScrollToLastMessage = jest.fn(() => {
  mockScrollTo();
});
jest.mock("@/app/hooks/use-scroll-to-last-message", () => ({
  useScrollToLastMessage: () => ({
    scrollToLastMessage: mockScrollToLastMessage,
  }),
}));

// Mock the mutation hook
const mockMutateAsync = jest.fn();
let mockIsPending = false;
let mockCurrentUser: unknown = null;

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useMutation: (options: unknown & { onSuccess: () => void }) => ({
    mutateAsync: mockMutateAsync.mockImplementation(async () => {
      // Call the onSuccess callback if it exists
      if (options?.onSuccess) {
        options.onSuccess();
      }
      return Promise.resolve({});
    }),
    get isPending() {
      return mockIsPending;
    },
  }),
  useQuery: jest.fn().mockImplementation((queryOptions: unknown) => {
    // Return mockCurrentUser for getCurrentUser queries
    // Check if this is a getCurrentUser query by looking at queryKey
    if (
      queryOptions &&
      typeof queryOptions === "object" &&
      "queryKey" in queryOptions
    ) {
      const queryKey = (queryOptions as { queryKey: unknown }).queryKey;
      if (
        Array.isArray(queryKey) &&
        queryKey.length >= 2 &&
        queryKey[0] === "user" &&
        queryKey[1] === "getCurrentUser"
      ) {
        return { data: mockCurrentUser };
      }
    }
    // Return initialData for report queries
    if (
      queryOptions &&
      typeof queryOptions === "object" &&
      "initialData" in queryOptions
    ) {
      return { data: (queryOptions as { initialData: unknown }).initialData };
    }
    return { data: undefined };
  }),
}));

const mockRequest = {
  id: "request-123",
  status: ReportStatus.COMPLETED,
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
  colleagues: [],
  coAuthors: [],
  coAuthorsId: [],
  userId: null,
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
      role: OrganizationRole.HELPER,
    }),
    organization: {
      id: "structure-1",
      name: "Test Structure",
      shortName: "TS",
      id_v1: "v1",
      additionalInformation: null,
      role: OrganizationRole.HELPER,
      type: TeamType.OTHERS_HELPERS,
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

describe("CloseRequest", () => {
  const queryClient = new QueryClient();

  const renderWithProvider = (component: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    mockScrollTo.mockClear();
    mockScrollToLastMessage.mockClear();
    mockMutateAsync.mockClear();
    mockIsPending = false;
    mockCurrentUser = {
      id: "author-1", // Must match mockRequest.authorId to pass isAuthorOrCoAuthor check
      role: USER_ROLES.USER,
      teams: [{ id: "team-1", role: OrganizationRole.HELPER }],
    };
    mockUseSession.mockReturnValue({
      data: { user: { id: "author-1", role: USER_ROLES.USER } },
      isPending: false,
    });
  });

  it("renders close request section for completed report", () => {
    renderWithProvider(<CloseRequest initialReport={mockRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Un signalement fermé reste accessible pendant 6 mois/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Six mois après sa fermeture, le signalement est supprimé/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("renders close section for author when report is in pending assignment", () => {
    const pendingRequest = {
      ...mockRequest,
      status: ReportStatus.PENDING_ASSIGNMENT,
    };

    renderWithProvider(<CloseRequest initialReport={pendingRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("renders close section for author when report is in treatment", () => {
    const inTreatmentRequest = {
      ...mockRequest,
      status: ReportStatus.IN_TREATMENT,
    };

    renderWithProvider(<CloseRequest initialReport={inTreatmentRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("calls updateReportStatus with CLOSED when author closes an in-treatment report", async () => {
    const inTreatmentRequest = {
      ...mockRequest,
      status: ReportStatus.IN_TREATMENT,
    };

    renderWithProvider(<CloseRequest initialReport={inTreatmentRequest} />);

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

  it("disables button when mutation is pending", () => {
    mockIsPending = true;
    renderWithProvider(<CloseRequest initialReport={mockRequest} />);

    const closeButton = screen.getByRole("button", {
      name: "Fermer le signalement",
    });
    expect(closeButton).toBeDisabled();
  });

  it("enables button when mutation is not pending", () => {
    mockIsPending = false;
    renderWithProvider(<CloseRequest initialReport={mockRequest} />);

    const closeButton = screen.getByRole("button", {
      name: "Fermer le signalement",
    });
    expect(closeButton).not.toBeDisabled();
  });

  it("shows correct button text", () => {
    renderWithProvider(<CloseRequest initialReport={mockRequest} />);

    expect(
      screen.getByRole("button", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("does not render anything for a closed request (reopen is handled by BackToInTreatmentSection)", () => {
    const closedRequest = {
      ...mockRequest,
      status: ReportStatus.CLOSED,
    };
    const { container } = renderWithProvider(
      <CloseRequest initialReport={closedRequest} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("calls updateReportStatus with CLOSED status when closing request", async () => {
    renderWithProvider(<CloseRequest initialReport={mockRequest} />);

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

  it("does not render for user who is not author or co-author", () => {
    mockCurrentUser = {
      id: "other-user",
      role: USER_ROLES.USER,
      teams: [{ id: "team-1", role: OrganizationRole.OPERATOR }],
    };

    const { container } = renderWithProvider(
      <CloseRequest initialReport={mockRequest} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders for author when session exists", () => {
    mockCurrentUser = {
      id: "author-1",
      role: USER_ROLES.USER,
      teams: [{ id: "team-1", role: OrganizationRole.HELPER }],
    };
    mockUseSession.mockReturnValue({
      data: { user: { id: "author-1", role: USER_ROLES.USER } },
      isPending: false,
    });

    renderWithProvider(<CloseRequest initialReport={mockRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("does not render when currentUser is undefined", () => {
    mockCurrentUser = undefined;
    mockUseSession.mockReturnValue({
      data: { user: { id: "author-1", role: USER_ROLES.USER } },
      isPending: false,
    });

    const { container } = renderWithProvider(
      <CloseRequest initialReport={mockRequest} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders for author when user has no teams", () => {
    mockCurrentUser = {
      id: "author-1",
      role: USER_ROLES.USER,
      teams: [],
    };

    renderWithProvider(<CloseRequest initialReport={mockRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("renders for co-author", () => {
    const requestWithCoAuthor = {
      ...mockRequest,
      coAuthors: [
        { ...createMockAuthor({ id: "co-author-1" }), hasViewed: false },
      ],
    };
    mockCurrentUser = {
      id: "co-author-1",
      role: USER_ROLES.USER,
      teams: [],
    };

    renderWithProvider(<CloseRequest initialReport={requestWithCoAuthor} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("does not render anything for a closed request even when applicant team is deleted", () => {
    const closedRequestWithDeletedTeam = {
      ...mockRequest,
      status: ReportStatus.CLOSED,
      applicantTeam: {
        ...mockRequest.applicantTeam,
        deletedAt: new Date("2024-06-01"),
      },
    };

    const { container } = renderWithProvider(
      <CloseRequest initialReport={closedRequestWithDeletedTeam} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders close section for admin when report is in pending assignment", () => {
    const pendingRequest = {
      ...mockRequest,
      status: ReportStatus.PENDING_ASSIGNMENT,
    };
    mockCurrentUser = {
      id: "admin-1",
      role: USER_ROLES.ADMIN,
      teams: [],
    };
    mockUseSession.mockReturnValue({
      data: { user: { id: "admin-1", role: USER_ROLES.ADMIN } },
      isPending: false,
    });

    renderWithProvider(<CloseRequest initialReport={pendingRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("renders close section for admin when report is in treatment", () => {
    const inTreatmentRequest = {
      ...mockRequest,
      status: ReportStatus.IN_TREATMENT,
    };
    mockCurrentUser = {
      id: "admin-1",
      role: USER_ROLES.ADMIN,
      teams: [],
    };
    mockUseSession.mockReturnValue({
      data: { user: { id: "admin-1", role: USER_ROLES.ADMIN } },
      isPending: false,
    });

    renderWithProvider(<CloseRequest initialReport={inTreatmentRequest} />);

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });

  it("admin can close a report in treatment with CLOSED status", async () => {
    const inTreatmentRequest = {
      ...mockRequest,
      status: ReportStatus.IN_TREATMENT,
    };
    mockCurrentUser = {
      id: "admin-1",
      role: USER_ROLES.ADMIN,
      teams: [],
    };
    mockUseSession.mockReturnValue({
      data: { user: { id: "admin-1", role: USER_ROLES.ADMIN } },
      isPending: false,
    });

    renderWithProvider(<CloseRequest initialReport={inTreatmentRequest} />);

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

  it("renders close section for completed report even when applicant team is deleted", () => {
    const completedRequestWithDeletedTeam = {
      ...mockRequest,
      status: ReportStatus.COMPLETED,
      applicantTeam: {
        ...mockRequest.applicantTeam,
        deletedAt: new Date("2024-06-01"),
      },
    };

    renderWithProvider(
      <CloseRequest initialReport={completedRequestWithDeletedTeam} />,
    );

    expect(
      screen.getByRole("heading", { name: "Fermer le signalement" }),
    ).toBeInTheDocument();
  });
});
