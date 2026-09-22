import { render, screen } from "@testing-library/react";
import { AnswerList } from "./answer-list";
import {
  OrganizationRole,
  ReportStatus,
  TeamType,
} from "@/generated/prisma/client";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

// Mock the hooks
jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    answer: {
      getAnswersWithStatusHistory: {
        queryOptions: jest.fn(() => ({
          queryKey: ["answer", "getAnswersWithStatusHistory"],
          queryFn: jest.fn(),
        })),
      },
      markAnswerAsViewed: {
        mutationOptions: jest.fn(() => ({
          mutationKey: ["answer", "markAnswerAsViewed"],
        })),
      },
    },
    report: {
      getReportById: {
        queryOptions: jest.fn(() => ({
          queryKey: ["report", "getReportById"],
          queryFn: jest.fn(),
        })),
      },
      updateReportStatus: {
        mutationOptions: jest.fn(() => ({})),
      },
    },
    user: {
      getCurrentUser: {
        queryOptions: jest.fn(() => ({
          queryKey: ["user", "getCurrentUser"],
          queryFn: jest.fn(),
        })),
      },
    },
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn((options) => {
    // Return the initialData passed to the component
    return {
      data: options.initialData,
    };
  }),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
  useMutation: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-id" }),
}));

jest.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { id: "user-1", role: "user" } },
  }),
}));

jest.mock("./close-section/close-section", () => ({
  CloseSection: () => null,
}));

const mockReport = {
  id: "report-1",
  status: ReportStatus.PENDING_ASSIGNMENT,
  caf: null,
  nir: null,
  nif: null,
  maritalName: null,
  subject: "Test subject",
  description: "Test description",
  phone: null,
  firstName: "John",
  lastName: "Doe",
  birthDate: "1990-01-01",
  citizenPermissionConfirmed: true,
  organizationId: "org-1",
  applicantTeamId: "team-1",
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
      id: "team-1",
      name: "Test Team",
      organizationId: "org-1",
      role: OrganizationRole.OPERATOR,
    }),
    organization: {
      id: "org-1",
      name: "Test Organization",
      shortName: "TO",
      id_v1: "v1",
      additionalInformation: null,
      role: OrganizationRole.OPERATOR,
      type: TeamType.OPERATOR,
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
    notificationsViewedBefore: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  lastAnswerAt: null,
  overdueAt: null,
};

describe("AnswerList", () => {
  it("renders Évolution du signalement title", () => {
    const mockDataWithAnswers = {
      answers: [
        {
          id: "1",
          content: "Test answer",
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: "author-1",
          reportId: "report-1",
          isOperatorOnly: false,
          isIrrelevant: false,
          hasStandardProcedure: false,
          isMetadataOnly: false,
          author: {
            id: "author-1",
            firstName: "John",
            lastName: "Doe",
            phone: "0123456789",
            profession: "Developer",
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
            notificationsViewedBefore: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            teams: [],
          },
          report: {
            id: "report-1",
            createdAt: new Date(),
            updatedAt: new Date(),
            firstName: "John",
            lastName: "Doe",
            status: ReportStatus.PENDING_ASSIGNMENT,
            organizationId: "org-1",
            caf: null,
            nir: null,
            nif: null,
            maritalName: null,
            subject: "Test subject",
            description: "Test description",
            phone: null,
            birthDate: "1990-01-01",
            citizenPermissionConfirmed: true,
            authorId: "author-1",
            areaId: "area-1",
            applicantTeamId: "team-1",
            userId: null,
            lastAnswerAt: null,
            overdueAt: null,
            coAuthorsId: [],
            coAuthors: [],
            applicantTeam: createMockReportTeam({
              id: "team-1",
              name: "Test Team",
              organizationId: "org-1",
              role: OrganizationRole.OPERATOR,
            }),
            requestedTeams: [],
          },
          files: [],
        },
      ],
      statusHistory: [],
    };
    render(
      <AnswerList
        requestId="test-id"
        initialData={mockDataWithAnswers}
        currentUserId="user-1"
        initialReport={mockReport}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("Évolution du signalement")).toBeInTheDocument();
  });

  it("renders with correct container styling", () => {
    const mockDataWithAnswers = {
      answers: [
        {
          id: "1",
          content: "Test answer",
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: "author-1",
          reportId: "report-1",
          isOperatorOnly: false,
          isIrrelevant: false,
          hasStandardProcedure: false,
          isMetadataOnly: false,
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
            notificationsViewedBefore: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            teams: [],
          },
          report: {
            id: "report-1",
            createdAt: new Date(),
            updatedAt: new Date(),
            firstName: "John",
            lastName: "Doe",
            status: ReportStatus.PENDING_ASSIGNMENT,
            organizationId: "org-1",
            caf: null,
            nir: null,
            nif: null,
            maritalName: null,
            subject: "Test subject",
            description: "Test description",
            phone: null,
            birthDate: "1990-01-01",
            citizenPermissionConfirmed: true,
            authorId: "author-1",
            areaId: "area-1",
            applicantTeamId: "team-1",
            userId: null,
            lastAnswerAt: null,
            overdueAt: null,
            coAuthorsId: [],
            applicantTeam: createMockReportTeam({
              id: "team-1",
              name: "Test Team",
              organizationId: "org-1",
              role: OrganizationRole.OPERATOR,
            }),
            requestedTeams: [],
          },
          files: [],
        },
      ],
      statusHistory: [],
    };
    const { container } = render(
      <AnswerList
        requestId="test-id"
        initialData={mockDataWithAnswers}
        currentUserId="user-1"
        initialReport={mockReport}
        userTimezone="Europe/Paris"
      />,
    );

    // Padding responsive (correctif RGAA 10.11 — pas de débordement à 320px) :
    // p-4 sm:p-8 md:p-12 lg:p-20 au lieu de p-20 fixe.
    const mainContainer = container.querySelector(".bg-white.lg\\:p-20");
    expect(mainContainer).toBeInTheDocument();
  });
});
