import { render, screen } from "@testing-library/react";
import type { AnswerType, AnswersType } from "./types";
import { AnswerItem } from "./answer-item/answer-item";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

const mockAnswer: AnswerType = {
  id: "answer-1",
  content: "Test message content",
  createdAt: new Date("2024-01-01T10:00:00Z"),
  updatedAt: new Date("2024-01-01T10:00:00Z"),
  authorId: "author-1",
  reportId: "request-1",
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
    email: "john.doe@example.com",
    name: "John Doe",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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
          organizationId: "organization-1",
          role: OrganizationRole.OPERATOR,
        }),
        organization: {
          id: "structure-1",
          name: "Test Structure",
          shortName: "TS",
          id_v1: "v1-id",
          createdAt: new Date(),
          updatedAt: new Date(),
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
    status: "PENDING_ASSIGNMENT" as const,
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
    areaId: "area-1",
    applicantTeamId: "group-1",
    organizationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAnswerAt: null,
    overdueAt: null,
    userId: null,
    applicantTeam: createMockReportTeam({
      id: "group-1",
      name: "Test Group",
      organizationId: "organization-1",
      role: OrganizationRole.OPERATOR,
    }),
    requestedTeams: [],
  },
  files: [],
};

const mockAnswers: AnswersType = [mockAnswer];

describe("AnswerItem", () => {
  it("renders message content", () => {
    render(
      <AnswerItem
        answer={mockAnswer}
        isAuthorAnswer={false}
        answers={mockAnswers}
        currentIndex={0}
        hasStatusAfter={false}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("Test message content")).toBeInTheDocument();
  });

  it("renders author info when showAuthorInfo is true", () => {
    render(
      <AnswerItem
        answer={mockAnswer}
        isAuthorAnswer={false}
        answers={mockAnswers}
        currentIndex={0}
        hasStatusAfter={true}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("applies correct alignment for author answer", () => {
    const { container } = render(
      <AnswerItem
        answer={mockAnswer}
        isAuthorAnswer={true}
        answers={mockAnswers}
        currentIndex={0}
        hasStatusAfter={false}
        userTimezone="Europe/Paris"
      />,
    );

    const flexContainer = container.querySelector(".flex.justify-end");
    expect(flexContainer).toBeInTheDocument();
  });

  it("applies correct alignment for helper answer", () => {
    const { container } = render(
      <AnswerItem
        answer={mockAnswer}
        isAuthorAnswer={false}
        answers={mockAnswers}
        currentIndex={0}
        hasStatusAfter={false}
        userTimezone="Europe/Paris"
      />,
    );

    const flexContainer = container.querySelector(".flex.justify-start");
    expect(flexContainer).toBeInTheDocument();
  });
});
