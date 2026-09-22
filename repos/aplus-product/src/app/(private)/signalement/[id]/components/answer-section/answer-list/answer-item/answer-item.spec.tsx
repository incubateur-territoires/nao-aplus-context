import { render, screen } from "@testing-library/react";
import type { AnswerType, AnswersType } from "../types";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

jest.mock("@/app/hooks/use-answer-view-tracking", () => ({
  useAnswerViewTracking: jest.fn(() => ({
    elementRef: { current: null },
    hasBeenMarked: false,
  })),
}));

import { AnswerItem } from "./answer-item";

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
          role: OrganizationRole.HELPER,
          organizationId: "organization-1",
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

// Mock user with OPERATOR team
const mockOperatorUser = {
  id: "user-1",
  role: USER_ROLES.USER,
  teams: [{ id: "team-1", role: OrganizationRole.OPERATOR }],
};

// Mock user with HELPER team
const mockHelperUser = {
  id: "user-1",
  role: USER_ROLES.USER,
  teams: [{ id: "team-1", role: OrganizationRole.HELPER }],
};

describe("AnswerItem", () => {
  beforeEach(() => {
    (useTRPC as jest.Mock).mockReturnValue({
      user: {
        getCurrentUser: {
          queryOptions: jest.fn().mockReturnValue({}),
        },
      },
    });
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
      error: null,
    });
    (useQuery as jest.Mock).mockReturnValue({
      data: mockOperatorUser,
    });
  });

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

  it("applies instructor only background for instructor messages", () => {
    const instructorAnswer = { ...mockAnswer, isOperatorOnly: true };

    render(
      <AnswerItem
        answer={instructorAnswer}
        isAuthorAnswer={false}
        answers={[instructorAnswer]}
        currentIndex={0}
        hasStatusAfter={false}
        userTimezone="Europe/Paris"
      />,
    );

    const messageContainer = document.querySelector(".bg-\\[\\#F5F5F5\\]");
    expect(messageContainer).toHaveClass("bg-[#F5F5F5]");
  });

  it("hides instructor-only message for users with HELPER teams", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: mockHelperUser,
    });

    const instructorAnswer = { ...mockAnswer, isOperatorOnly: true };

    const { container } = render(
      <AnswerItem
        answer={instructorAnswer}
        isAuthorAnswer={false}
        answers={[instructorAnswer]}
        currentIndex={0}
        hasStatusAfter={false}
        userTimezone="Europe/Paris"
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Test message content")).not.toBeInTheDocument();
  });

  it("shows instructor-only message for users with OPERATOR teams", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: mockOperatorUser,
    });

    const instructorAnswer = { ...mockAnswer, isOperatorOnly: true };

    render(
      <AnswerItem
        answer={instructorAnswer}
        isAuthorAnswer={false}
        answers={[instructorAnswer]}
        currentIndex={0}
        hasStatusAfter={false}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("Test message content")).toBeInTheDocument();
  });

  it("shows instructor-only message when user has no session", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });
    (useQuery as jest.Mock).mockReturnValue({ data: undefined });

    const instructorAnswer = { ...mockAnswer, isOperatorOnly: true };

    render(
      <AnswerItem
        answer={instructorAnswer}
        isAuthorAnswer={false}
        answers={[instructorAnswer]}
        currentIndex={0}
        hasStatusAfter={false}
        userTimezone="Europe/Paris"
      />,
    );

    expect(screen.getByText("Test message content")).toBeInTheDocument();
  });

  it("renders metadata-only message with left-aligned layout", () => {
    const metadataAnswer = { ...mockAnswer, isMetadataOnly: true };

    const { container } = render(
      <AnswerItem
        answer={metadataAnswer}
        isAuthorAnswer={false}
        answers={[metadataAnswer]}
        currentIndex={0}
        hasStatusAfter={false}
        userTimezone="Europe/Paris"
      />,
    );

    const leftAlignedContainer = container.querySelector(".flex.justify-start");
    expect(leftAlignedContainer).toBeInTheDocument();
    expect(leftAlignedContainer).toHaveClass("pl-[15%]");
    expect(screen.getByText("Test message content")).toBeInTheDocument();
  });

  it("shows regular message for user with HELPER team when not instructor-only", () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: mockHelperUser,
    });

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

  describe("author info display with hidden messages", () => {
    beforeEach(() => {
      (useQuery as jest.Mock).mockReturnValue({
        data: mockHelperUser,
      });
    });

    it("shows author info only on last visible message when hidden message is in between", () => {
      const answer1 = {
        ...mockAnswer,
        id: "answer-1",
        content: "First visible message",
        authorId: "author-1",
      };
      const hiddenAnswer = {
        ...mockAnswer,
        id: "answer-2",
        content: "Hidden instructor-only message",
        authorId: "author-1",
        isOperatorOnly: true,
      };
      const answer2 = {
        ...mockAnswer,
        id: "answer-3",
        content: "Second visible message",
        authorId: "author-1",
      };
      const answers: AnswersType = [answer1, hiddenAnswer, answer2];

      // First visible message should not show author info
      const { unmount } = render(
        <AnswerItem
          answer={answer1}
          isAuthorAnswer={false}
          answers={answers}
          currentIndex={0}
          hasStatusAfter={false}
          userTimezone="Europe/Paris"
        />,
      );

      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      expect(screen.getByText("First visible message")).toBeInTheDocument();

      unmount();

      // Last visible message should show author info
      render(
        <AnswerItem
          answer={answer2}
          isAuthorAnswer={false}
          answers={answers}
          currentIndex={2}
          hasStatusAfter={false}
          userTimezone="Europe/Paris"
        />,
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Second visible message")).toBeInTheDocument();
    });

    it("shows author info when next visible message is from different author", () => {
      const answer1 = {
        ...mockAnswer,
        id: "answer-1",
        content: "Message from author 1",
        authorId: "author-1",
      };
      const hiddenAnswer = {
        ...mockAnswer,
        id: "answer-2",
        content: "Hidden message",
        authorId: "author-1",
        isOperatorOnly: true,
      };
      const answer2 = {
        ...mockAnswer,
        id: "answer-3",
        content: "Message from author 2",
        authorId: "author-2",
        author: {
          ...mockAnswer.author,
          id: "author-2",
          firstName: "Jane",
          lastName: "Smith",
          name: "Jane Smith",
        },
      };
      const answers: AnswersType = [answer1, hiddenAnswer, answer2];

      render(
        <AnswerItem
          answer={answer1}
          isAuthorAnswer={false}
          answers={answers}
          currentIndex={0}
          hasStatusAfter={false}
          userTimezone="Europe/Paris"
        />,
      );

      // Should show author info because next visible message is from different author
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("shows author info on last visible message when all subsequent are hidden", () => {
      const answer1 = {
        ...mockAnswer,
        id: "answer-1",
        content: "Last visible message",
        authorId: "author-1",
      };
      const hiddenAnswer1 = {
        ...mockAnswer,
        id: "answer-2",
        content: "Hidden 1",
        authorId: "author-1",
        isOperatorOnly: true,
      };
      const hiddenAnswer2 = {
        ...mockAnswer,
        id: "answer-3",
        content: "Hidden 2",
        authorId: "author-1",
        isOperatorOnly: true,
      };
      const answers: AnswersType = [answer1, hiddenAnswer1, hiddenAnswer2];

      render(
        <AnswerItem
          answer={answer1}
          isAuthorAnswer={false}
          answers={answers}
          currentIndex={0}
          hasStatusAfter={false}
          userTimezone="Europe/Paris"
        />,
      );

      // Should show author info because it's the last visible message
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });
});
