import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InviteColleague } from "./invite-colleague";
import { User } from "@/generated/prisma/client";
import { OrganizationRole } from "@/generated/prisma/enums";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

// Mock TRPCWrapper to avoid complex dependencies in tests
const MockTRPCWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div data-testid="trpc-wrapper">{children}</div>
    </QueryClientProvider>
  );
};

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "request-123" }),
}));

// Mock window.scrollTo
const mockScrollTo = jest.fn();
window.scrollTo = mockScrollTo;

// Mock scrollToLastMessage function
const mockScrollToLastMessage = jest.fn(() => {
  const container = document.getElementById("answer-list");
  if (container && container.scrollIntoView) {
    container.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }
});

// Mock the useScrollToLastMessage hook
jest.mock("@/app/hooks/use-scroll-to-last-message", () => ({
  useScrollToLastMessage: () => ({
    scrollToLastMessage: mockScrollToLastMessage,
  }),
}));

// Mock the useCreateAnswer hook
jest.mock(
  "../../answer-section/render-choice/render-choice-form/use-create-answer",
  () => ({
    useCreateAnswer: () => ({
      mutateAsync: jest.fn().mockResolvedValue({}),
      isPending: false,
    }),
  }),
);

// Mock the mutation hook
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useMutation: () => ({
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

// Mock TRPC client
jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    report: {
      addCoAuthorsToReport: {
        mutationOptions: jest.fn(() => ({
          mutationFn: jest.fn().mockResolvedValue({}),
        })),
      },
      getReportById: {
        queryOptions: jest.fn(() => ({
          queryKey: ["report", "getReportById"],
        })),
      },
    },
    answer: {
      getAnswersWithStatusHistory: {
        queryOptions: jest.fn(() => ({
          queryKey: ["answer", "getAnswersWithStatusHistory"],
        })),
      },
    },
  }),
}));

const mockColleagues: User[] = [
  {
    id: "colleague-1",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    name: "John Doe",
    phone: "0123456789",
    profession: "Developer",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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
  },
  {
    id: "colleague-2",
    phone: "0123456789",
    profession: "Developer",
    role: USER_ROLES.USER,
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    name: "Jane Smith",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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
  },
];

const mockReportAuthor: User = {
  id: "author-1",
  phone: "0123456789",
  profession: "Developer",
  firstName: "Author",
  lastName: "Name",
  email: "author@example.com",
  name: "Author Name",
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
};

const mockReportApplicantTeam = createMockReportTeam({
  id: "team-1",
  name: "Test Team",
  organizationId: "org-1",
  role: OrganizationRole.OPERATOR,
});

describe("InviteColleague", () => {
  const mockOnResetSelection = jest.fn();

  beforeEach(() => {
    mockScrollTo.mockClear();
    mockScrollToLastMessage.mockClear();
    mockOnResetSelection.mockClear();
    // Create mock answer-list container
    const container = document.createElement("div");
    container.id = "answer-list";
    container.scrollIntoView = jest.fn();
    document.body.appendChild(container);
  });

  afterEach(() => {
    const container = document.getElementById("answer-list");
    if (container) {
      document.body.removeChild(container);
    }
  });

  it("renders colleague checkboxes when colleagues are available", () => {
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    expect(
      screen.getByText("Sélectionnez les membres de l'équipe à inviter :"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("colleague-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("colleague-2")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders message input field", () => {
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    expect(screen.getByText("Votre message (optionnel)")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    expect(
      screen.getByRole("button", {
        name: /Inviter.*membres.*équipe/,
      }),
    ).toBeInTheDocument();
  });

  it("handles colleague selection", () => {
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    const colleague1Checkbox = screen.getByDisplayValue("colleague-1");
    expect(colleague1Checkbox).not.toBeChecked();

    fireEvent.click(colleague1Checkbox);
    expect(colleague1Checkbox).toBeChecked();
  });

  it("handles message input", () => {
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    const messageInput = screen.getByRole("textbox");
    fireEvent.change(messageInput, { target: { value: "Test message" } });

    expect(messageInput).toHaveValue("Test message");
  });

  it("calls scrollTo when submit button is clicked", async () => {
    // Select a colleague first (required for submission)
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    const colleague1Checkbox = screen.getByDisplayValue("colleague-1");
    fireEvent.click(colleague1Checkbox);

    const submitButton = screen.getByRole("button", {
      name: /Inviter.*membres.*équipe/,
    });
    fireEvent.click(submitButton);

    // Wait for the mutation to complete and scrollToLastMessage to be called
    await waitFor(
      () => {
        expect(mockScrollToLastMessage).toHaveBeenCalled();
        const container = document.getElementById("answer-list");
        expect(container?.scrollIntoView).toHaveBeenCalledWith({
          behavior: "smooth",
          block: "end",
        });
      },
      { timeout: 3000 },
    );
  });

  it("clears form after submission", async () => {
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    // Select a colleague and add a message
    const colleague1Checkbox = screen.getByDisplayValue("colleague-1");
    fireEvent.click(colleague1Checkbox);

    const messageInput = screen.getByRole("textbox");
    fireEvent.change(messageInput, { target: { value: "Test message" } });

    const submitButton = screen.getByRole("button", {
      name: /Inviter.*membres.*équipe/,
    });
    fireEvent.click(submitButton);

    // Wait for form to be cleared
    await waitFor(() => {
      expect(messageInput).toHaveValue("");
      expect(colleague1Checkbox).not.toBeChecked();
    });
  });

  it("calls onResetSelection after successful submission", async () => {
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    // Select a colleague
    const colleague1Checkbox = screen.getByDisplayValue("colleague-1");
    fireEvent.click(colleague1Checkbox);

    const submitButton = screen.getByRole("button", {
      name: /Inviter.*membres.*équipe/,
    });
    fireEvent.click(submitButton);

    // Wait for onResetSelection to be called
    await waitFor(() => {
      expect(mockOnResetSelection).toHaveBeenCalledTimes(1);
    });
  });

  it("handles multiple colleague selection", () => {
    render(
      <MockTRPCWrapper>
        <InviteColleague
          colleaguesToInvite={mockColleagues}
          onResetSelection={mockOnResetSelection}
          reportAuthor={mockReportAuthor}
          reportApplicantTeam={mockReportApplicantTeam}
        />
      </MockTRPCWrapper>,
    );

    const colleague1Checkbox = screen.getByDisplayValue("colleague-1");
    const colleague2Checkbox = screen.getByDisplayValue("colleague-2");

    fireEvent.click(colleague1Checkbox);
    fireEvent.click(colleague2Checkbox);

    expect(colleague1Checkbox).toBeChecked();
    expect(colleague2Checkbox).toBeChecked();
  });
});
