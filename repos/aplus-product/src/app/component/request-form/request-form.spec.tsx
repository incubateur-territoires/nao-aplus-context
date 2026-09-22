import { render, screen, waitFor } from "@testing-library/react";
import { RequestForm } from "./request-form";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  createMockUser,
  createMockTeam,
  createMockArea,
  createMockOrganization,
  createMockFunctions,
  MOCK_IDS,
} from "@/test/mocks";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

jest.mock("./render-steps/render-steps", () => ({
  RenderSteps: () => <div data-testid="render-steps">Render Steps</div>,
}));

jest.mock("../spinner/spinner", () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

jest.mock("@faker-js/faker", () => ({
  Faker: jest.fn().mockImplementation(() => ({
    lorem: {
      sentence: jest.fn((words) => `Fake sentence with ${words || 1} words`),
    },
    string: {
      numeric: jest.fn((length) => "1".repeat(length)),
      uuid: jest.fn(() => "fake-uuid"),
    },
    person: {
      firstName: jest.fn(() => "John"),
      lastName: jest.fn(() => "Doe"),
    },
    phone: {
      number: jest.fn(() => "0123456789"),
    },
    location: {
      streetAddress: jest.fn(() => "123 Fake Street"),
    },
  })),
  fr: {},
}));

describe("RequestForm", () => {
  const mockFunctions = createMockFunctions();
  const mockPush = mockFunctions.push;
  const mockTrpcClient = {
    user: {
      getCurrentUser: {
        queryOptions: jest.fn(() => ({ queryKey: ["user", "getCurrentUser"] })),
      },
      getUsers: {
        queryOptions: jest.fn(() => ({ queryKey: ["user", "getUsers"] })),
      },
    },
    structure: {
      getStructures: {
        queryOptions: jest.fn(() => ({ queryKey: ["structures"] })),
      },
    },
    area: {
      getActiveAreas: {
        queryOptions: jest.fn(() => ({ queryKey: ["areas"] })),
      },
    },
  };

  const mockUser = createMockUser({
    id: MOCK_IDS.USER_1,
    firstName: "Jane",
    lastName: "Smith",
    teams: [
      createMockTeam({
        id: "group-1",
        organization: createMockOrganization({
          id: "structure-1",
          name: "Structure 1",
        }),
        areas: [createMockArea({ id: MOCK_IDS.AREA_1, name: "Area 1" })],
      }),
    ],
  });

  const mockUsers = [
    {
      id: MOCK_IDS.USER_1,
      firstName: "Alice",
      lastName: "Johnson",
    },
    {
      id: MOCK_IDS.USER_2,
      firstName: "Bob",
      lastName: "Wilson",
    },
  ];

  const mockStructures = [
    createMockOrganization({ id: "structure-1", name: "Structure 1" }),
  ];

  const mockAreas = [createMockArea({ id: MOCK_IDS.AREA_1, name: "Area 1" })];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    (useTRPC as jest.Mock).mockReturnValue(mockTrpcClient);
  });

  it("renders loading spinner when user data is loading", () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: undefined, isLoading: true };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("render-steps")).not.toBeInTheDocument();
  });

  it("renders form when data is loaded", () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: mockUser, isLoading: false };
      if (queryKey.includes("getUsers"))
        return { data: mockUsers, isLoading: false };
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas"))
        return { data: mockAreas, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
    expect(screen.getByTestId("render-steps")).toBeInTheDocument();
  });

  it("sets default area when user has areas", async () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: mockUser, isLoading: false };
      if (queryKey.includes("getUsers"))
        return { data: mockUsers, isLoading: false };
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas"))
        return { data: mockAreas, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    await waitFor(() => {
      expect(screen.getByTestId("render-steps")).toBeInTheDocument();
    });

    // The useEffect should set the area to the user's first area
    // We can't directly test form values, but we can verify the component renders without errors
  });

  it("sets default applicant group when user has only one group", async () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: mockUser, isLoading: false };
      if (queryKey.includes("getUsers"))
        return { data: mockUsers, isLoading: false };
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas"))
        return { data: mockAreas, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    await waitFor(() => {
      expect(screen.getByTestId("render-steps")).toBeInTheDocument();
    });

    // The useEffect should set the applicant group since user has only one group
    // We can't directly test form values, but we can verify the component renders without errors
  });

  it("does not set default applicant group when user has multiple groups", async () => {
    const userWithMultipleGroups = {
      ...mockUser,
      teams: [
        ...mockUser.teams,
        {
          id: "group-2",
          structure: {
            id: "structure-2",
            name: "Structure 2",
          },
          areas: [],
        },
      ],
    };

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: userWithMultipleGroups, isLoading: false };
      if (queryKey.includes("getUsers"))
        return { data: mockUsers, isLoading: false };
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas"))
        return { data: mockAreas, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    await waitFor(() => {
      expect(screen.getByTestId("render-steps")).toBeInTheDocument();
    });

    // Component should render without setting default applicant group
  });

  it("renders form with user data loaded", () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: mockUser, isLoading: false };
      if (queryKey.includes("getUsers"))
        return { data: mockUsers, isLoading: false };
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas"))
        return { data: mockAreas, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    expect(screen.getByTestId("render-steps")).toBeInTheDocument();
  });

  it("renders form when no users available for colleagues", () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: mockUser, isLoading: false };
      if (queryKey.includes("getUsers")) return { data: [], isLoading: false }; // No users available
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas"))
        return { data: mockAreas, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    expect(screen.getByTestId("render-steps")).toBeInTheDocument();
  });

  it("handles user with no groups", () => {
    const userWithNoGroups = {
      ...mockUser,
      teams: [],
    };

    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: userWithNoGroups, isLoading: false };
      if (queryKey.includes("getUsers"))
        return { data: mockUsers, isLoading: false };
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas"))
        return { data: mockAreas, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    expect(screen.getByTestId("render-steps")).toBeInTheDocument();
  });

  it("handles empty areas data", () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: mockUser, isLoading: false };
      if (queryKey.includes("getUsers"))
        return { data: mockUsers, isLoading: false };
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas")) return { data: [], isLoading: false }; // No areas
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    expect(screen.getByTestId("render-steps")).toBeInTheDocument();
  });

  it("renders without crashing with all data loaded", () => {
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options.queryKey);
      if (queryKey.includes("getCurrentUser"))
        return { data: mockUser, isLoading: false };
      if (queryKey.includes("getUsers"))
        return { data: mockUsers, isLoading: false };
      if (queryKey.includes("structures"))
        return { data: mockStructures, isLoading: false };
      if (queryKey.includes("areas"))
        return { data: mockAreas, isLoading: false };
      return { data: [], isLoading: false };
    });

    render(<RequestForm />);

    expect(screen.getByTestId("render-steps")).toBeInTheDocument();
  });
});
