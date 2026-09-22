import "@testing-library/jest-dom";
import {
  mockTRPC,
  mockUseQuery,
  mockUseMutation,
  mockQueryClient,
  mockUseParams,
  mockUseRouter,
  mockUseSearchParams,
  mockUsePathname,
  mockScrollTo,
  mockConsole,
} from "./utils/global-mocks";

// Polyfill structuredClone for Jest (jsdom doesn't have it)
if (typeof structuredClone === "undefined") {
  global.structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
}

// Polyfill crypto.randomUUID for Jest
if (typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", {
    value: () =>
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }),
  });
}

// Global mocks
jest.mock("@/trpc/client", () => ({
  useTRPC: () => mockTRPC,
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: () => mockQueryClient,
}));

jest.mock("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: mockUseRouter,
  useSearchParams: mockUseSearchParams,
  usePathname: mockUsePathname,
}));

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: jest.fn(() => ({
      data: null,
      isPending: false,
      error: null,
    })),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  useSession: jest.fn(() => ({
    data: null,
    isPending: false,
    error: null,
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock console methods
global.console = {
  ...console,
  ...mockConsole,
};

// Mock window.scrollTo
Object.defineProperty(window, "scrollTo", {
  value: mockScrollTo,
  writable: true,
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
})) as unknown as typeof IntersectionObserver;

// Mock ResizeObserver : absent de jsdom, il fait échouer le montage de tout
// composant qui l'instancie (ex. StatsChart, qui reconstruit son graphique au
// redimensionnement). Jamais déclenché en test : jsdom ne fait pas de layout.
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
})) as unknown as typeof ResizeObserver;

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockImplementation((options) => {
    const queryKey = JSON.stringify(options.queryKey);

    if (queryKey.includes("user")) {
      if (queryKey.includes("random")) {
        return {
          data: {
            id: "user1",
            firstName: "John",
            lastName: "Doe",
            teams: [
              {
                id: "group1",
                name: "Group 1",
                areas: [
                  { id: "area1", name: "Area 1" },
                  { id: "area2", name: "Area 2" },
                ],
              },
              {
                id: "group2",
                name: "Group 2",
                areas: [{ id: "area1", name: "Area 1" }],
              },
            ],
          },
          isLoading: false,
          error: null,
        };
      }
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

    if (queryKey.includes("report")) {
      return {
        data: {
          id: "test-report-id",
          status: "PENDING_ASSIGNMENT",
          subject: "Test Report",
          description: "Test Description",
          answers: [],
          files: [],
        },
        isLoading: false,
        error: null,
      };
    }

    if (queryKey.includes("answer")) {
      return {
        data: [],
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
  });

  mockUseMutation.mockImplementation(() => {
    return {
      mutateAsync: jest.fn(),
      isPending: false,
      isError: false,
      error: null,
    };
  });
});
