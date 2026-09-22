import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ProfileContent } from "./profile-content";
import { useTRPC } from "@/trpc/client";

jest.mock("@/trpc/client", () => ({
  useTRPC: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useQueryClient: jest.fn(),
  };
});

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

import { createMockUser, createMockFunctions, MOCK_IDS } from "@/test/mocks";
import { NotificationFrequency } from "@/generated/prisma/enums";

const mockUser = createMockUser({
  id: MOCK_IDS.USER_1,
  email: "test@example.com",
  firstName: "John",
  lastName: "Doe",
  name: "John Doe",
  emailVerified: true,
});

const mockFunctions = createMockFunctions();
const mockUpdateProfile = mockFunctions.mutateAsync.mockResolvedValue({
  success: true,
});
const mockQueryClient = {
  refetchQueries: jest.fn(),
  getQueryData: jest.fn(),
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("ProfileContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);
    (useMutation as jest.Mock).mockImplementation(() => ({
      mutateAsync: mockUpdateProfile,
      isPending: false,
    }));
    (useTRPC as jest.Mock).mockReturnValue({
      user: {
        getCurrentUser: {
          queryOptions: () => ({
            queryKey: ["user", "current"],
            queryFn: async () => mockUser,
          }),
        },
        updateProfile: {
          mutationOptions: () => ({
            mutationKey: ["user", "updateProfile"],
            mutationFn: mockUpdateProfile,
          }),
        },
        isManager: {
          queryOptions: () => ({
            queryKey: ["user", "isManager"],
            queryFn: async () => false,
          }),
        },
        isSupervisor: {
          queryOptions: () => ({
            queryKey: ["user", "isSupervisor"],
            queryFn: async () => false,
          }),
        },
        canDisableNotifications: {
          queryOptions: () => ({
            queryKey: ["user", "canDisableNotifications"],
            queryFn: async () => true,
          }),
        },
      },
    });
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("user") && queryKey.includes("current")) {
        return {
          data: mockUser,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isManager")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isSupervisor")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
      };
    });
  });

  it("renders the profile form with user data", async () => {
    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Identifiants de connexion")).toBeInTheDocument();
      expect(screen.getByText("Adresse e-mail")).toBeInTheDocument();
      expect(screen.getByText("Informations personnelles")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0123456789")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Developer")).toBeInTheDocument();
  });

  it("displays the user email", async () => {
    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
    });
  });

  it("displays email modification notice", async () => {
    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText(/Vous ne pouvez pas modifier votre adresse e-mail/),
      ).toBeInTheDocument();
    });
  });

  it("displays teams section when user has teams", async () => {
    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Équipes")).toBeInTheDocument();
      expect(
        screen.getByText("Vous faites partie des équipes :"),
      ).toBeInTheDocument();
      expect(screen.getByText("Équipe A")).toBeInTheDocument();
    });
  });

  it("does not display teams section when user has no teams", async () => {
    const userWithoutTeams = { ...mockUser, teams: [] };
    (useTRPC as jest.Mock).mockReturnValue({
      user: {
        getCurrentUser: {
          queryOptions: () => ({
            queryKey: ["user", "current"],
            queryFn: async () => userWithoutTeams,
          }),
        },
        updateProfile: {
          mutationOptions: () => ({
            mutationKey: ["user", "updateProfile"],
            mutationFn: mockUpdateProfile,
          }),
        },
        isManager: {
          queryOptions: () => ({
            queryKey: ["user", "isManager"],
            queryFn: async () => false,
          }),
        },
        isSupervisor: {
          queryOptions: () => ({
            queryKey: ["user", "isSupervisor"],
            queryFn: async () => false,
          }),
        },
        canDisableNotifications: {
          queryOptions: () => ({
            queryKey: ["user", "canDisableNotifications"],
            queryFn: async () => true,
          }),
        },
      },
    });
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("user") && queryKey.includes("current")) {
        return {
          data: userWithoutTeams,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isManager")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isSupervisor")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
      };
    });

    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText("Équipes")).not.toBeInTheDocument();
    });
  });

  it("validates required fields", async () => {
    const user = userEvent.setup();
    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText("Prénom");
    await user.clear(firstNameInput);

    const submitButton = screen.getByRole("button", {
      name: /Enregistrer les modifications/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Veuillez saisir votre prénom."),
      ).toBeInTheDocument();
    });
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText("Prénom");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Jane");

    const submitButton = screen.getByRole("button", {
      name: /Enregistrer les modifications/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        firstName: "Jane",
        lastName: "Doe",
        phone: "0123456789",
        profession: "Developer",
        notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
      });
    });
  });

  it("handles empty optional fields", async () => {
    const user = userEvent.setup();
    const userWithoutOptionalFields = {
      ...mockUser,
      phone: null,
      profession: null,
    };

    (useTRPC as jest.Mock).mockReturnValue({
      user: {
        getCurrentUser: {
          queryOptions: () => ({
            queryKey: ["user", "current"],
            queryFn: async () => userWithoutOptionalFields,
          }),
        },
        updateProfile: {
          mutationOptions: () => ({
            mutationKey: ["user", "updateProfile"],
            mutationFn: mockUpdateProfile,
          }),
        },
        isManager: {
          queryOptions: () => ({
            queryKey: ["user", "isManager"],
            queryFn: async () => false,
          }),
        },
        isSupervisor: {
          queryOptions: () => ({
            queryKey: ["user", "isSupervisor"],
            queryFn: async () => false,
          }),
        },
        canDisableNotifications: {
          queryOptions: () => ({
            queryKey: ["user", "canDisableNotifications"],
            queryFn: async () => true,
          }),
        },
      },
    });
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("user") && queryKey.includes("current")) {
        return {
          data: userWithoutOptionalFields,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isManager")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isSupervisor")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
      };
    });

    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByDisplayValue("John")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", {
      name: /Enregistrer les modifications/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        firstName: "John",
        lastName: "Doe",
        phone: null,
        profession: null,
        notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
      });
    });
  });

  it("shows loading state", () => {
    (useTRPC as jest.Mock).mockReturnValue({
      user: {
        getCurrentUser: {
          queryOptions: () => ({
            queryKey: ["user", "current"],
            queryFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              return mockUser;
            },
          }),
        },
        updateProfile: {
          mutationOptions: () => ({
            mutationKey: ["user", "updateProfile"],
            mutationFn: mockUpdateProfile,
          }),
        },
        isManager: {
          queryOptions: () => ({
            queryKey: ["user", "isManager"],
            queryFn: async () => false,
          }),
        },
        isSupervisor: {
          queryOptions: () => ({
            queryKey: ["user", "isSupervisor"],
            queryFn: async () => false,
          }),
        },
        canDisableNotifications: {
          queryOptions: () => ({
            queryKey: ["user", "canDisableNotifications"],
            queryFn: async () => true,
          }),
        },
      },
    });
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("user") && queryKey.includes("current")) {
        return {
          data: undefined,
          isLoading: true,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isManager")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isSupervisor")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
      };
    });

    render(<ProfileContent />, { wrapper: createWrapper() });

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  it("correctly mocks isManager query status", async () => {
    // Mock isManager as true
    (useTRPC as jest.Mock).mockReturnValue({
      user: {
        getCurrentUser: {
          queryOptions: () => ({
            queryKey: ["user", "current"],
            queryFn: async () => mockUser,
          }),
        },
        updateProfile: {
          mutationOptions: () => ({
            mutationKey: ["user", "updateProfile"],
            mutationFn: mockUpdateProfile,
          }),
        },
        isManager: {
          queryOptions: () => ({
            queryKey: ["user", "isManager"],
            queryFn: async () => true,
          }),
        },
        isSupervisor: {
          queryOptions: () => ({
            queryKey: ["user", "isSupervisor"],
            queryFn: async () => false,
          }),
        },
        canDisableNotifications: {
          queryOptions: () => ({
            queryKey: ["user", "canDisableNotifications"],
            queryFn: async () => true,
          }),
        },
      },
    });
    (useQuery as jest.Mock).mockImplementation((options) => {
      const queryKey = JSON.stringify(options?.queryKey || []);
      if (queryKey.includes("user") && queryKey.includes("current")) {
        return {
          data: mockUser,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isManager")) {
        return {
          data: true,
          isLoading: false,
        };
      }
      if (queryKey.includes("user") && queryKey.includes("isSupervisor")) {
        return {
          data: false,
          isLoading: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
      };
    });

    render(<ProfileContent />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Notifications par e-mail")).toBeInTheDocument();
    });

    // Verify that the isManager query is being called correctly
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["user", "isManager"],
      }),
    );
  });
});
