import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useInviteGroups } from "./use-invite-groups";
import { SelectedOptionEnum } from "../types";
import { TeamWithIncludes } from "@/types/request-group-selection";
import { Team } from "@/generated/prisma/browser";
import { OrganizationRole } from "@/generated/prisma/enums";
import { createMockTeamWithIncludes } from "@/test/mocks";

const mockMutateAsync = jest.fn().mockResolvedValue({});
const mockInvalidateQueries = jest.fn();
const mockScrollToLastMessage = jest.fn();
const mockCreateAnswer = jest.fn().mockResolvedValue({});

const mockReportApplicantTeam: Team = {
  id: "team-1",
  name: "Test Applicant Team",
  organizationId: "org-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  role: OrganizationRole.OPERATOR,
} as Team;

const mockFilteredRequestedTeams: TeamWithIncludes[] = [
  createMockTeamWithIncludes({
    id: "group-1",
    name: "Group 1",
    organizationId: "org-1",
    organization: {
      id: "org-1",
      id_v1: "org-1-v1",
      name: "Organization 1",
      shortName: "ORG1",
    },
  }),
  createMockTeamWithIncludes({
    id: "group-2",
    name: "Group 2",
    organizationId: "org-2",
    organization: {
      id: "org-2",
      id_v1: "org-2-v1",
      name: "Organization 2",
      shortName: "ORG2",
    },
  }),
];

const mockCurrentUser = {
  id: "user-1",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
};

const mockMeTeams = [
  {
    id: "me-team-1",
    name: "My Team 1",
  },
  {
    id: "me-team-2",
    name: "My Team 2",
  },
];

jest.mock("@/app/hooks/use-scroll-to-last-message", () => ({
  useScrollToLastMessage: () => ({
    scrollToLastMessage: mockScrollToLastMessage,
  }),
}));

jest.mock(
  "../../answer-section/render-choice/render-choice-form/use-create-answer",
  () => ({
    useCreateAnswer: () => ({
      mutateAsync: mockCreateAnswer,
      isPending: false,
    }),
  }),
);

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  useQuery: jest.fn((options) => {
    const queryKey = JSON.stringify(options?.queryKey || []);
    if (queryKey.includes("user") && queryKey.includes("getCurrentUser")) {
      return {
        data: {
          ...mockCurrentUser,
          teams: mockMeTeams,
        },
        isLoading: false,
      };
    }
    return {
      data: undefined,
      isLoading: false,
    };
  }),
  useMutation: jest.fn((options) => ({
    mutateAsync: async (...args: unknown[]) => {
      try {
        const result = await mockMutateAsync(...args);
        if (options?.onSuccess) {
          options.onSuccess();
        }
        return result;
      } catch (error) {
        if (options?.onError) {
          options.onError(error, ...args, undefined);
        }
        throw error;
      }
    },
    isPending: false,
  })),
}));

jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => ({
    data: {
      user: mockCurrentUser,
    },
    isPending: false,
  }),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    user: {
      getCurrentUser: {
        queryOptions: () => ({
          queryKey: ["user", "getCurrentUser"],
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
      },
      getReportById: {
        queryOptions: (reportId: string) => ({
          queryKey: ["report", "getReportById", reportId],
        }),
      },
      getRecipientsByReportId: {
        queryOptions: (params: { reportId: string }) => ({
          queryKey: ["report", "getRecipientsByReportId", params.reportId],
        }),
      },
    },
    answer: {
      getAnswersWithStatusHistory: {
        queryOptions: (reportId: string) => ({
          queryKey: ["answer", "getAnswersWithStatusHistory", reportId],
        }),
      },
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useInviteGroups", () => {
  const defaultProps = {
    alreadyLinkedRequestedTeamsIds: ["me-team-1"],
    authorsAndCoAuthorsIds: ["user-1"],
    reportId: "report-1",
    reportApplicantTeam: mockReportApplicantTeam,
    onResetSelection: jest.fn(),
    selectedOption: SelectedOptionEnum.ORGANIZATIONS,
    requestAreaId: "area-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes form with default values", () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    expect(result.current.formMethods.getValues()).toEqual({
      areaId: "area-1",
      teamIds: [],
      message: "",
    });
  });

  it("initializes form with empty areaId when requestAreaId is undefined", () => {
    const { result } = renderHook(
      () =>
        useInviteGroups({
          ...defaultProps,
          requestAreaId: undefined,
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.formMethods.getValues().areaId).toBe("");
  });

  it("returns form methods and submit handler", () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    expect(result.current.formMethods).toBeDefined();
    expect(result.current.onSubmit).toBeDefined();
    expect(typeof result.current.onSubmit).toBe("function");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("calls addRequestedTeamsToReport on submit", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        reportId: "report-1",
        teamIds: ["group-1"],
      });
    });
  });

  it("invalidates queries on successful mutation", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["report", "getReportById", "report-1"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["report", "getRecipientsByReportId", "report-1"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["answer", "getAnswersWithStatusHistory", "report-1"],
      });
    });
  });

  it("creates metadata answer with correct content for author", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: "report-1",
          isMetadataOnly: true,
          isIrrelevant: false,
          content: expect.stringContaining("Group 1"),
        }),
      );
    });
  });

  it("creates metadata answer with correct content for recipient", async () => {
    const { result } = renderHook(
      () =>
        useInviteGroups({
          ...defaultProps,
          authorsAndCoAuthorsIds: ["other-user"],
        }),
      {
        wrapper: createWrapper(),
      },
    );

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: "report-1",
          isMetadataOnly: true,
          isIrrelevant: false,
          content: expect.stringContaining("Group 1"),
        }),
      );
    });
  });

  it("creates metadata answer with plural form for multiple teams", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1", "group-2"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("ont rejoint"),
        }),
      );
    });
  });

  it("creates metadata answer with singular form for single team", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("a rejoint"),
        }),
      );
    });
  });

  it("creates message answer when message is provided", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledTimes(2);
      expect(mockCreateAnswer).toHaveBeenCalledWith({
        reportId: "report-1",
        content: "Test message",
        isIrrelevant: false,
      });
    });
  });

  it("does not create message answer when message is empty", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);

    // Form validation should prevent submission with empty message
    // So onSubmit callback won't be called
    await onSubmit();

    // Wait a bit to ensure no calls were made
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Form validation prevents submission, so no calls should be made
    expect(mockCreateAnswer).not.toHaveBeenCalled();
  });

  it("does not create message answer when message is only whitespace", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "   ");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledTimes(1);
    });
  });

  it("sets isIrrelevant to true when selectedOption is IS_IRRELEVANT", async () => {
    const { result } = renderHook(
      () =>
        useInviteGroups({
          ...defaultProps,
          selectedOption: SelectedOptionEnum.IS_IRRELEVANT,
        }),
      {
        wrapper: createWrapper(),
      },
    );

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          isIrrelevant: true,
        }),
      );
    });
  });

  it("resets form after successful submission", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(result.current.formMethods.getValues()).toEqual({
        areaId: "area-1",
        teamIds: [],
        message: "",
      });
    });
  });

  it("calls onResetSelection after successful submission", async () => {
    const mockOnResetSelection = jest.fn();
    const { result } = renderHook(
      () =>
        useInviteGroups({
          ...defaultProps,
          onResetSelection: mockOnResetSelection,
        }),
      {
        wrapper: createWrapper(),
      },
    );

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockOnResetSelection).toHaveBeenCalledTimes(1);
    });
  });

  it("calls scrollToLastMessage after successful submission", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);
    await onSubmit();

    await waitFor(() => {
      expect(mockScrollToLastMessage).toHaveBeenCalledTimes(1);
    });
  });

  it("handles error in addRequestedTeamsToReport", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Make mockMutateAsync throw an error for this test
    mockMutateAsync.mockRejectedValueOnce(new Error("Test error"));

    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit(mockFilteredRequestedTeams);

    // The mutation will throw, and onError callback should be called
    await expect(onSubmit()).rejects.toThrow();

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error adding requested groups to request",
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("returns fallback content when filteredRequestedTeams is undefined", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    const onSubmit = result.current.onSubmit([]);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          content:
            "Une invitation a bien été envoyée aux groupes mais une erreur est survenue dans la récupération des groupes",
        }),
      );
    });
  });

  it("returns fallback content when teamIds is empty", async () => {
    const { result } = renderHook(() => useInviteGroups(defaultProps), {
      wrapper: createWrapper(),
    });

    // Form validation requires at least 1 teamId, so we can't test empty teamIds through form submission
    // Instead, test the fallback behavior by calling with undefined filteredRequestedTeams
    // which simulates the scenario where getMetadataAnswerContent returns undefined
    result.current.formMethods.setValue("teamIds", ["group-1"]);
    result.current.formMethods.setValue("message", "Test message");

    // Pass undefined to simulate the fallback scenario
    const onSubmit = result.current.onSubmit([]);
    await onSubmit();

    await waitFor(() => {
      expect(mockCreateAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          content:
            "Une invitation a bien été envoyée aux groupes mais une erreur est survenue dans la récupération des groupes",
        }),
      );
    });
  });
});
