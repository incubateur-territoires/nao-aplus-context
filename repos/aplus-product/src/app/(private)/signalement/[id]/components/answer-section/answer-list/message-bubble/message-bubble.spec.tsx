import { render, screen } from "@testing-library/react";
import { MessageBubble } from "./message-bubble";
import type { AnswerType } from "../types";
import { OrganizationRole } from "@/generated/prisma/enums";
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
    phone: "012356789",
    profession: "Developer",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    name: "John Doe",
    emailVerified: true,
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
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
    teams: [],
  },
  report: {
    id: "request-1",
    authorId: "author-1",
    status: "PENDING_ASSIGNMENT" as const,
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
    citizenPermissionConfirmed: true,
    areaId: "area-1",
    applicantTeamId: "group-1",
    organizationId: null,
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
    lastAnswerAt: null,
    overdueAt: null,
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

const mockInstructorAnswer: AnswerType = {
  ...mockAnswer,
  isOperatorOnly: true,
};

describe("MessageBubble", () => {
  it("renders regular message content", () => {
    render(
      <MessageBubble
        answer={mockAnswer}
        backgroundClass="bg-blue-100"
        shouldShowOnlyHours={false}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("Test message content")).toBeInTheDocument();
  });

  it("renders instructor only message with notice", () => {
    render(
      <MessageBubble
        answer={mockInstructorAnswer}
        backgroundClass="bg-gray-100"
        shouldShowOnlyHours={false}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("Test message content")).toBeInTheDocument();
    expect(
      screen.getByText("Message visible uniquement par les opérateurs"),
    ).toBeInTheDocument();
  });

  it("applies correct background class", () => {
    const { container } = render(
      <MessageBubble
        answer={mockAnswer}
        backgroundClass="bg-blue-100"
        shouldShowOnlyHours={false}
        userTimezone="Europe/Paris"
      />,
    );

    const messageContainer = container.querySelector(".p-8");
    expect(messageContainer).toHaveClass("bg-blue-100");
  });
});
