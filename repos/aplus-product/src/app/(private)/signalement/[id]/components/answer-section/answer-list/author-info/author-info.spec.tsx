import { render, screen } from "@testing-library/react";
import { AuthorInfo } from "./author-info";
import type { AnswerType } from "../types";
import { ReportStatus } from "@/generated/prisma/client";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

// Mock useSession for UserLink component
jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "current-user",
        email: "test@example.com",
        role: "user", // Non-admin user - links won't be displayed
      },
    },
    isPending: false,
  }),
}));

const mockAnswer: AnswerType = {
  id: "answer-1",
  content: "Test content",
  createdAt: new Date("2024-01-01T10:00:00Z"),
  updatedAt: new Date("2024-01-01T10:00:00Z"),
  authorId: "author-1",
  reportId: "request-1",
  isOperatorOnly: false,
  isIrrelevant: false,
  hasStandardProcedure: false,
  isMetadataOnly: false,
  author: {
    phone: "0123456789",
    profession: "Developer",
    id: "author-1",
    firstName: "John",
    lastName: "Doe",
    createdAt: new Date(),
    updatedAt: new Date(),
    email: "john.doe@example.com",
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
    teams: [
      {
        ...createMockReportTeam({
          id: "group-1",
          name: "Test Group",
          organizationId: "structure-1",
          role: OrganizationRole.OPERATOR,
        }),
        organization: {
          id: "structure-1",
          name: "Test Structure",
          shortName: "TG",
          createdAt: new Date(),
          updatedAt: new Date(),
          id_v1: "structure-1-v1",
          additionalInformation: null,
          role: OrganizationRole.OPERATOR,
          type: TeamType.OPERATOR,
        },
      },
    ],
  },
  report: {
    id: "request-1",
    authorId: "author-1",
    status: ReportStatus.PENDING_ASSIGNMENT,
    caf: null,
    nir: null,
    nif: null,
    maritalName: null,
    subject: "Test subject",
    description: "Test description",
    phone: null,
    firstName: "Test",
    lastName: "User",
    birthDate: "1990-01-01",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAnswerAt: null,
    overdueAt: null,
    areaId: "area-1",
    applicantTeamId: "group-1",
    citizenPermissionConfirmed: true,
    organizationId: "structure-1",
    userId: null,
    applicantTeam: createMockReportTeam({
      id: "group-1",
      name: "Test Group",
      organizationId: "structure-1",
      role: OrganizationRole.OPERATOR,
    }),
    requestedTeams: [],
  },
  files: [],
};

const mockAuthorTeam = {
  ...createMockReportTeam({
    id: "group-1",
    name: "Test Group",
    organizationId: "structure-1",
    role: OrganizationRole.OPERATOR,
  }),
  organization: {
    id: "structure-1",
    name: "Test Structure",
    shortName: "TG",
    createdAt: new Date(),
    updatedAt: new Date(),
    id_v1: "structure-1-v1",
    additionalInformation: null,
    role: OrganizationRole.OPERATOR,
    type: TeamType.OPERATOR,
  },
};

describe("AuthorInfo", () => {
  it("renders author name and group", () => {
    render(
      <AuthorInfo
        answer={mockAnswer}
        authorGroup={mockAuthorTeam}
        textAlignmentClass="text-left"
        authorInfoClass=""
        isAuthorAnswer={false}
      />,
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("(Test Group)")).toBeInTheDocument();
  });

  it("applies correct alignment classes", () => {
    render(
      <AuthorInfo
        answer={mockAnswer}
        authorGroup={mockAuthorTeam}
        textAlignmentClass="text-right"
        authorInfoClass="flex-row-reverse"
        isAuthorAnswer={true}
      />,
    );

    const authorInfo = screen.getByText("John Doe").closest("div");
    expect(authorInfo).toHaveClass("text-right");
  });

  it("renders without group name when authorGroup is undefined", () => {
    render(
      <AuthorInfo
        answer={mockAnswer}
        authorGroup={undefined}
        textAlignmentClass="text-left"
        authorInfoClass=""
        isAuthorAnswer={false}
      />,
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.queryByText(/Test Group/)).not.toBeInTheDocument();
  });
});
