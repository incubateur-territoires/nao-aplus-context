import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { InviteGroups } from "./invite-groups";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganizationRole } from "@/generated/prisma/enums";
import { SelectedOptionEnum } from "../types";
import { createMockReportTeam, USER_ROLES } from "@/test/mocks";

const mockAreas = [
  { id: "area-1", name: "Area 1" },
  { id: "area-2", name: "Area 2" },
];

const mockGroups = [
  {
    id: "group-1",
    name: "Group 1",
    organization: {
      id: "struct-1",
      name: "Structure 1",
      shortName: "STRUCT1",
      tags: [{ id: "tag-1", name: "Tag 1" }],
      specificFields: [],
      additionalInformation: null,
    },
    organizationId: "struct-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockReportAuthor = {
  phone: "0123456789",
  profession: "Developer",
  id: "author-1",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  name: "John Doe",
  emailVerified: true,
  role: USER_ROLES.USER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockReportApplicantTeam = {
  ...createMockReportTeam({
    id: "team-1",
    name: "Test Team",
    organizationId: "struct-1",
    role: OrganizationRole.OPERATOR,
  }),
  organization: {
    id: "org-1",
    name: "Test Org",
    shortName: "TEST",
    tags: [],
    specificFields: [],
    additionalInformation: null,
    role: OrganizationRole.OPERATOR,
    createdAt: new Date(),
    updatedAt: new Date(),
    id_v1: "org-1-v1",
  },
};

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "request-123" }),
}));

// Mock scrollToLastMessage function
const mockScrollToLastMessage = jest.fn();
const mockMutateAsync = jest.fn().mockResolvedValue({});

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
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
  }),
);

// Mock useSession
jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => ({
    data: {
      user: mockReportAuthor,
    },
    isPending: false,
  }),
}));

// Mock the mutation hook
const mockInvalidateQueries = jest.fn();
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

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    area: {
      getActiveAreas: {
        queryOptions: () => ({
          queryKey: ["areas"],
          queryFn: async () => mockAreas,
        }),
      },
    },
    group: {
      getActiveGroupsByAreaIds: {
        queryOptions: () => ({
          queryKey: ["groups"],
          queryFn: async () => mockGroups,
        }),
      },
    },
    team: {
      getActiveTeamsByAreaIds: {
        queryOptions: () => ({
          queryKey: ["teams"],
          queryFn: async () => mockGroups,
        }),
      },
      getActiveOperatorTeamsByAreaIds: {
        queryOptions: () => ({
          queryKey: ["operatorTeams"],
          queryFn: async () => mockGroups,
        }),
      },
      getNotInvitedTeamsByReportId: {
        queryOptions: () => ({
          queryKey: ["notInvitedTeams"],
          queryFn: async () => mockGroups,
        }),
      },
    },
    user: {
      getCurrentUser: {
        queryOptions: () => ({
          queryKey: ["user", "getCurrentUser"],
          queryFn: async () => ({
            ...mockReportAuthor,
            teams: [],
          }),
        }),
      },
    },
    report: {
      addRequestedTeamsToReport: {
        mutationOptions: (options?: {
          onSuccess?: () => void;
          onError?: () => void;
        }) => ({
          mutationFn: mockMutateAsync,
          ...options,
        }),
        mutate: jest.fn().mockResolvedValue({}),
      },
      getReportById: {
        queryOptions: jest.fn(() => ({
          queryKey: ["report", "getReportById"],
          queryFn: jest.fn(),
        })),
      },
      getRecipientsByReportId: {
        queryOptions: jest.fn((params: { reportId: string }) => ({
          queryKey: ["report", "getRecipientsByReportId", params.reportId],
          queryFn: jest.fn(),
        })),
      },
    },
    answer: {
      createAnswer: {
        mutationOptions: (options?: {
          onSuccess?: () => void;
          onError?: () => void;
        }) => ({
          mutationFn: mockMutateAsync,
          ...options,
        }),
        mutate: jest.fn().mockResolvedValue({}),
      },
      getAnswersWithStatusHistory: {
        queryOptions: jest.fn(() => ({
          queryKey: ["answer", "getAnswersWithStatusHistory"],
          queryFn: jest.fn(),
        })),
      },
    },
  }),
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  // Pre-populate areas cache
  queryClient.setQueryData(["areas"], mockAreas);
  // Pre-populate operator teams cache for the area used in tests
  queryClient.setQueryData(["operatorTeams"], mockGroups);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("InviteGroups", () => {
  const mockOnResetSelection = jest.fn();

  beforeEach(() => {
    mockScrollToLastMessage.mockClear();
    mockOnResetSelection.mockClear();
    mockMutateAsync.mockClear();
    mockInvalidateQueries.mockClear();
  });

  it("renders groups after loading", async () => {
    render(
      <TestWrapper>
        <InviteGroups
          isAuthor={true}
          requestAreaId="area-1"
          alreadyLinkedRequestedTeamsIds={[]}
          onResetSelection={mockOnResetSelection}
          authorsAndCoAuthorsIds={[mockReportAuthor.id]}
          reportApplicantTeam={mockReportApplicantTeam}
          selectedOption={SelectedOptionEnum.ORGANIZATIONS}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Équipe(s) opérateur à contacter"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.getByText(/STRUCT1/)).toBeInTheDocument();
  });

  it("calls onResetSelection after successful submission", async () => {
    render(
      <TestWrapper>
        <InviteGroups
          isAuthor={true}
          requestAreaId="area-1"
          alreadyLinkedRequestedTeamsIds={[]}
          onResetSelection={mockOnResetSelection}
          authorsAndCoAuthorsIds={[mockReportAuthor.id]}
          reportApplicantTeam={mockReportApplicantTeam}
          selectedOption={SelectedOptionEnum.ORGANIZATIONS}
        />
      </TestWrapper>,
    );

    // Wait for groups to load
    await waitFor(() => {
      expect(
        screen.getByText("Équipe(s) opérateur à contacter"),
      ).toBeInTheDocument();
    });

    // Select a group
    const groupCheckbox = screen.getByDisplayValue("group-1");
    fireEvent.click(groupCheckbox);

    // Submit the form
    const submitButton = screen.getByRole("button", {
      name: /Inviter.*équipes.*opérateur/,
    });
    fireEvent.click(submitButton);

    // Wait for onResetSelection to be called
    await waitFor(() => {
      expect(mockOnResetSelection).toHaveBeenCalledTimes(1);
    });
  });

  it("renders the territory select with areas", async () => {
    render(
      <TestWrapper>
        <InviteGroups
          isAuthor={true}
          requestAreaId="area-1"
          alreadyLinkedRequestedTeamsIds={[]}
          onResetSelection={mockOnResetSelection}
          authorsAndCoAuthorsIds={[mockReportAuthor.id]}
          reportApplicantTeam={mockReportApplicantTeam}
          selectedOption={SelectedOptionEnum.ORGANIZATIONS}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("Territoire concerné")).toBeInTheDocument();
    });

    expect(screen.getByText("Area 1")).toBeInTheDocument();
    expect(screen.getByText("Area 2")).toBeInTheDocument();
  });

  it("pre-selects the report area in the territory select", async () => {
    render(
      <TestWrapper>
        <InviteGroups
          isAuthor={true}
          requestAreaId="area-1"
          alreadyLinkedRequestedTeamsIds={[]}
          onResetSelection={mockOnResetSelection}
          authorsAndCoAuthorsIds={[mockReportAuthor.id]}
          reportApplicantTeam={mockReportApplicantTeam}
          selectedOption={SelectedOptionEnum.ORGANIZATIONS}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("area-1");
    });
  });

  it("resets selected teams when territory changes", async () => {
    render(
      <TestWrapper>
        <InviteGroups
          isAuthor={true}
          requestAreaId="area-1"
          alreadyLinkedRequestedTeamsIds={[]}
          onResetSelection={mockOnResetSelection}
          authorsAndCoAuthorsIds={[mockReportAuthor.id]}
          reportApplicantTeam={mockReportApplicantTeam}
          selectedOption={SelectedOptionEnum.ORGANIZATIONS}
        />
      </TestWrapper>,
    );

    // Wait for groups to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("group-1")).toBeInTheDocument();
    });

    // Select a group
    const groupCheckbox = screen.getByDisplayValue("group-1");
    fireEvent.click(groupCheckbox);
    expect(groupCheckbox).toBeChecked();

    // Change territory
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "area-2" } });

    // The checkbox selection should be reset
    await waitFor(() => {
      const checkbox = screen.queryByDisplayValue("group-1");
      if (checkbox) {
        expect(checkbox).not.toBeChecked();
      }
    });
  });

  it("shows empty state when no territory is selected", async () => {
    render(
      <TestWrapper>
        <InviteGroups
          isAuthor={true}
          requestAreaId={undefined}
          alreadyLinkedRequestedTeamsIds={[]}
          onResetSelection={mockOnResetSelection}
          authorsAndCoAuthorsIds={[mockReportAuthor.id]}
          reportApplicantTeam={mockReportApplicantTeam}
          selectedOption={SelectedOptionEnum.ORGANIZATIONS}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("Territoire concerné")).toBeInTheDocument();
    });

    // No teams should be displayed without a selected territory
    expect(
      screen.queryByText("Équipe(s) opérateur à contacter"),
    ).not.toBeInTheDocument();
  });

  it("clears form after submission", async () => {
    render(
      <TestWrapper>
        <InviteGroups
          isAuthor={true}
          requestAreaId="area-1"
          alreadyLinkedRequestedTeamsIds={[]}
          onResetSelection={mockOnResetSelection}
          authorsAndCoAuthorsIds={[mockReportAuthor.id]}
          reportApplicantTeam={mockReportApplicantTeam}
          selectedOption={SelectedOptionEnum.ORGANIZATIONS}
        />
      </TestWrapper>,
    );

    // Wait for groups to load
    await waitFor(() => {
      expect(
        screen.getByText("Équipe(s) opérateur à contacter"),
      ).toBeInTheDocument();
    });

    // Select a group and add a message
    const groupCheckbox = screen.getByDisplayValue("group-1");
    fireEvent.click(groupCheckbox);

    const messageInput = screen.getByRole("textbox");
    fireEvent.change(messageInput, { target: { value: "Test message" } });

    // Submit the form
    const submitButton = screen.getByRole("button", {
      name: /Inviter.*équipes.*opérateur/,
    });
    fireEvent.click(submitButton);

    // Wait for form to be cleared
    await waitFor(() => {
      expect(messageInput).toHaveValue("");
      expect(groupCheckbox).not.toBeChecked();
    });
  });
});
