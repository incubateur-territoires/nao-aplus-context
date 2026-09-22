jest.mock("@/trpc/client", () => ({
  TRPCProvider: ({ children }: { children: React.ReactNode }) => children,
  useTRPC: () => ({
    area: {
      getActiveAreas: {
        queryOptions: () => ({ queryKey: ["area"] }),
      },
    },
    team: {
      getActiveTeamsByAreaIds: {
        queryOptions: () => ({ queryKey: ["team"] }),
      },
      getActiveOperatorTeamsByAreaIds: {
        queryOptions: () => ({ queryKey: ["team", "operator"] }),
      },
      getNotInvitedTeamsByReportId: {
        queryOptions: () => ({ queryKey: ["team", "notInvited"] }),
      },
    },
    organization: {
      getActiveOrganizations: {
        queryOptions: () => ({ queryKey: ["organization"] }),
      },
      getOrganizationsByAreaIds: {
        queryOptions: () => ({ queryKey: ["organization", "byArea"] }),
      },
    },
    user: {
      getUsers: {
        queryOptions: () => ({ queryKey: ["user", "getUsers"] }),
      },
      getCurrentUser: {
        queryOptions: () => ({ queryKey: ["user", "getCurrentUser"] }),
      },
    },
    request: {
      createRequest: {
        mutationOptions: () => ({ mutationKey: ["request", "create"] }),
      },
    },
    report: {
      createReport: {
        mutationOptions: () => ({ mutationKey: ["report", "create"] }),
      },
      updateReportStatus: {
        mutationOptions: () => ({ mutationKey: ["report", "updateStatus"] }),
      },
      getReportById: {
        queryOptions: () => ({ queryKey: ["report", "getById"] }),
      },
      getTeamHelpers: {
        queryOptions: () => ({ queryKey: ["report", "getTeamHelpers"] }),
      },
      getColleagues: {
        queryOptions: () => ({ queryKey: ["report", "getColleagues"] }),
      },
    },
    file: {
      uploadFiles: {
        mutationOptions: () => ({ mutationKey: ["file", "upload"] }),
      },
    },
  }),
}));

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { RenderSteps } from "./render-steps";
import { RequestFormWrapper } from "@/test/utils/request-form.wrapper";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockStep: string | null = null;
const mockCreateRequest = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "step" ? mockStep : null),
    toString: () => (mockStep ? `step=${mockStep}` : ""),
  }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/signalement",
}));

// Remove this mock since Step4 uses trpc.report.createReport directly

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn().mockImplementation((options) => {
    const queryKey = JSON.stringify(options.queryKey);
    if (queryKey.includes("getCurrentUser")) {
      return {
        data: {
          id: "user1",
          firstName: "John",
          lastName: "Doe",
          teams: [
            { id: "group1", name: "Group 1" },
            { id: "group2", name: "Group 2" },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    if (queryKey.includes("getUsers")) {
      return {
        data: [
          { id: "user1", firstName: "John", lastName: "Doe" },
          { id: "user2", firstName: "Jane", lastName: "Smith" },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (queryKey.includes("team")) {
      return {
        data: [
          {
            id: "group1",
            name: "Group 1",
            organization: {
              id: "structure1",
              name: "Structure 1",
              tags: [
                { id: "tag1", name: "Tag 1" },
                { id: "tag2", name: "Tag 2" },
              ],
            },
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (queryKey.includes("operator")) {
      return {
        data: [
          {
            id: "group1",
            name: "Group 1",
            organization: {
              id: "structure1",
              name: "Structure 1",
              tags: [
                { id: "tag1", name: "Tag 1" },
                { id: "tag2", name: "Tag 2" },
              ],
            },
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (queryKey.includes("organization")) {
      return {
        data: [
          {
            id: "structure1",
            name: "Structure 1",
            tags: [
              { id: "tag1", name: "Tag 1" },
              { id: "tag2", name: "Tag 2" },
            ],
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (queryKey.includes("getTeamHelpers")) {
      return {
        data: [
          { id: "user1", firstName: "John", lastName: "Doe" },
          { id: "user2", firstName: "Jane", lastName: "Smith" },
        ],
        isLoading: false,
        error: null,
      };
    }
    if (queryKey.includes("getColleagues")) {
      return {
        data: [
          { id: "user1", firstName: "John", lastName: "Doe" },
          { id: "user2", firstName: "Jane", lastName: "Smith" },
        ],
        isLoading: false,
        error: null,
      };
    }
    return {
      data: [
        { id: "area1", name: "Area 1", value: "area1", label: "Area 1" },
        { id: "area2", name: "Area 2", value: "area2", label: "Area 2" },
      ],
      isLoading: false,
      error: null,
    };
  }),
  useMutation: jest.fn().mockImplementation((options) => {
    if (options.mutationKey?.includes("report")) {
      return {
        mutateAsync: mockCreateRequest,
        isPending: false,
        isError: false,
        error: null,
      };
    }
    return {
      mutateAsync: jest.fn(),
      isPending: false,
      isError: false,
      error: null,
    };
  }),
}));

// Mock window.scrollTo
const mockScrollTo = jest.fn();
Object.defineProperty(window, "scrollTo", {
  value: mockScrollTo,
  writable: true,
});

describe("RenderSteps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });
  it("renders Step1 by default", () => {
    mockStep = null;
    render(<RenderSteps />, { wrapper: AllProviders });
    expect(screen.getByLabelText(/Territoire/i)).toBeInTheDocument();
  });

  it("renders Step1 when step=1", () => {
    mockStep = "1";
    render(<RenderSteps />, { wrapper: AllProviders });
    expect(screen.getByLabelText(/Territoire/i)).toBeInTheDocument();
  });

  it("renders Step2 when step=2", () => {
    mockStep = "2";
    render(<RenderSteps />, { wrapper: AllProviders });
    expect(screen.getByLabelText(/Prénom/i)).toBeInTheDocument();
  });

  it("renders Step3 when step=3", () => {
    mockStep = "3";
    render(<RenderSteps />, { wrapper: AllProviders });
    expect(screen.getByLabelText(/Sujet du signalement/i)).toBeInTheDocument();
  });

  it("renders Step4 when step=4", () => {
    mockStep = "4";
    render(<RenderSteps />, { wrapper: AllProviders });
    expect(
      screen.getByText(/Destinataires du signalement/i),
    ).toBeInTheDocument();
  });

  it("renders Step1 when step is invalid", () => {
    mockStep = "invalid";
    render(<RenderSteps />, { wrapper: AllProviders });
    expect(screen.getByLabelText(/Territoire/i)).toBeInTheDocument();
  });

  it("scrolls to top when component mounts", () => {
    mockStep = "1";
    render(<RenderSteps />, { wrapper: AllProviders });

    jest.runAllTimers();

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  it("scrolls to top when step changes", () => {
    mockStep = "1";
    const { rerender } = render(<RenderSteps />, { wrapper: AllProviders });

    jest.runAllTimers();
    expect(mockScrollTo).toHaveBeenCalledTimes(1);

    mockStep = "2";
    rerender(<RenderSteps />);

    jest.runAllTimers();
    expect(mockScrollTo).toHaveBeenCalledTimes(2);
    expect(mockScrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RequestFormWrapper>{children}</RequestFormWrapper>
    </QueryClientProvider>
  );
}
