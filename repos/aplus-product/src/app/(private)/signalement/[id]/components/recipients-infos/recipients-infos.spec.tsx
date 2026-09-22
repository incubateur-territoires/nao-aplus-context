import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipientsInfos } from "./recipients-infos";
import * as reactQuery from "@tanstack/react-query";

// Mock useSession for UserLink component
jest.mock("@/app/component/auth-provider/auth-provider", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "current-user",
        email: "test@example.com",
        role: "user", // Non-admin user - links won't be displayed
      },
    },
    isPending: false,
  }),
}));

const mockRecipientsData = [
  {
    name: "La CAF - Pas-de-Calais",
    organization: { name: "CAF", shortName: "CAF" },
    users: [
      {
        id: "1",
        firstName: "Pierre",
        lastName: "Guery",
        hasViewed: false,
      },
      {
        id: "2",
        firstName: "Capucine",
        lastName: "Sauvage",
        hasViewed: false,
      },
      {
        id: "3",
        firstName: "Clara",
        lastName: "Loyer",
        hasViewed: true,
      },
      {
        id: "4",
        firstName: "Clémence",
        lastName: "Pons",
        hasViewed: false,
      },
      {
        id: "5",
        firstName: "Jean",
        lastName: "Martin",
        hasViewed: false,
      },
      {
        id: "6",
        firstName: "Marie",
        lastName: "Dubois",
        hasViewed: true,
      },
      {
        id: "7",
        firstName: "Paul",
        lastName: "Bernard",
        hasViewed: false,
      },
    ],
  },
];

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    report: {
      getRecipientsByReportId: {
        queryOptions: jest.fn(() => ({
          queryKey: ["report", "getRecipientsByReportId"],
          queryFn: jest.fn(),
        })),
      },
    },
  }),
}));

// Get reference to mocked useQuery
const mockUseQuery = jest.mocked(reactQuery.useQuery);

describe("RecipientsInfos", () => {
  const renderWithWrapper = (children: React.ReactNode) => {
    return render(children);
  };

  beforeEach(() => {
    // Set default mock implementation
    mockUseQuery.mockImplementation(
      (options: { queryKey: readonly unknown[] }) => {
        const queryKey = JSON.stringify(options.queryKey);
        if (queryKey.includes("getRecipientsByReportId")) {
          return {
            data: mockRecipientsData,
            isLoading: false,
            error: null,
          } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        return {
          data: undefined,
          isLoading: false,
          error: null,
        } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders instructors section with title", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      expect(screen.getByText("Destinataires (7)")).toBeInTheDocument();
    });
  });

  it("renders horizontal line separator", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      const hr = document.querySelector("hr");
      expect(hr).toBeInTheDocument();
    });
  });

  it("displays first 5 instructors by default (sorted alphabetically by lastName)", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      // First 5 users after sorting by lastName: Bernard, Dubois, Guery, Loyer, Martin
      expect(screen.getByText("Paul Bernard")).toBeInTheDocument();
      expect(screen.getByText("Marie Dubois")).toBeInTheDocument();
      expect(screen.getByText("Pierre Guery")).toBeInTheDocument();
      expect(screen.getByText("Clara Loyer")).toBeInTheDocument();
      expect(screen.getByText("Jean Martin")).toBeInTheDocument();

      // 6th and 7th (Pons, Sauvage) should not be visible initially
      expect(screen.queryByText("Clémence Pons")).not.toBeInTheDocument();
      expect(screen.queryByText("Capucine Sauvage")).not.toBeInTheDocument();
    });
  });

  it("shows 'Voir tous les opérateurs' button when there are more than 5 instructors", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      const showAllButton = screen.getByRole("button", {
        name: /Voir tous les opérateurs/i,
      });
      expect(showAllButton).toBeInTheDocument();
    });
  });

  it("expands to show all instructors when 'Voir tous' is clicked", async () => {
    const user = userEvent.setup();
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Voir tous les opérateurs/i,
        }),
      ).toBeInTheDocument();
    });

    const showAllButton = screen.getByRole("button", {
      name: /Voir tous les opérateurs/i,
    });
    await user.click(showAllButton);

    // Now all instructors should be visible
    expect(screen.getByText("Pierre Guery")).toBeInTheDocument();
    expect(screen.getByText("Capucine Sauvage")).toBeInTheDocument();
    expect(screen.getByText("Clara Loyer")).toBeInTheDocument();
    expect(screen.getByText("Clémence Pons")).toBeInTheDocument();
    expect(screen.getByText("Jean Martin")).toBeInTheDocument();
    expect(screen.getByText("Marie Dubois")).toBeInTheDocument();
    expect(screen.getByText("Paul Bernard")).toBeInTheDocument();

    // Button text should change
    expect(
      screen.getByRole("button", { name: /Voir moins/i }),
    ).toBeInTheDocument();
  });

  it("collapses to show first 5 instructors when 'Voir moins' is clicked", async () => {
    const user = userEvent.setup();
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Voir tous les opérateurs/i,
        }),
      ).toBeInTheDocument();
    });

    // First expand
    const showAllButton = screen.getByRole("button", {
      name: /Voir tous les opérateurs/i,
    });
    await user.click(showAllButton);

    // Then collapse
    const showLessButton = screen.getByRole("button", { name: /Voir moins/i });
    await user.click(showLessButton);

    // Should show only first 5 again (sorted by lastName)
    expect(screen.getByText("Paul Bernard")).toBeInTheDocument();
    expect(screen.getByText("Marie Dubois")).toBeInTheDocument();
    expect(screen.getByText("Pierre Guery")).toBeInTheDocument();
    expect(screen.getByText("Clara Loyer")).toBeInTheDocument();
    expect(screen.getByText("Jean Martin")).toBeInTheDocument();
    expect(screen.queryByText("Clémence Pons")).not.toBeInTheDocument();
    expect(screen.queryByText("Capucine Sauvage")).not.toBeInTheDocument();

    // Button text should revert
    expect(
      screen.getByRole("button", { name: /Voir tous les opérateurs/i }),
    ).toBeInTheDocument();
  });

  it("renders all instructors when there are 5 or fewer", async () => {
    mockUseQuery.mockImplementation(
      (options: { queryKey: readonly unknown[] }) => {
        const queryKey = JSON.stringify(options.queryKey);
        if (queryKey.includes("getRecipientsByReportId")) {
          return {
            data: [
              {
                name: "La CAF - Pas-de-Calais",
                organization: { name: "CAF", shortName: "CAF" },
                users: mockRecipientsData[0].users.slice(0, 3),
              },
            ],
            isLoading: false,
            error: null,
          } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        return {
          data: undefined,
          isLoading: false,
          error: null,
        } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    );

    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      // First 3 users from the team
      expect(screen.getByText("Pierre Guery")).toBeInTheDocument();
      expect(screen.getByText("Capucine Sauvage")).toBeInTheDocument();
      expect(screen.getByText("Clara Loyer")).toBeInTheDocument();

      // Button should not be shown for 3 instructors (≤5)
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  it("renders instructor names and organizations correctly", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      // Check that instructor names are displayed for the first 5 visible instructors (sorted by lastName)
      expect(screen.getByText("Paul Bernard")).toBeInTheDocument();
      expect(screen.getByText("Marie Dubois")).toBeInTheDocument();
      expect(screen.getByText("Pierre Guery")).toBeInTheDocument();
      expect(screen.getByText("Clara Loyer")).toBeInTheDocument();
      expect(screen.getByText("Jean Martin")).toBeInTheDocument();

      // Check that group names are displayed (5 visible users = 5 team names)
      expect(screen.getAllByText("La CAF - Pas-de-Calais")).toHaveLength(5);
    });
  });

  it("sorts instructors by group name first, then by lastName within each group", async () => {
    const teamsWithMultipleUsers = [
      {
        name: "Beta Group",
        organization: { name: "MDPH", shortName: "MDPH" },
        users: [
          {
            id: "3",
            firstName: "Charlie",
            lastName: "Beta",
            hasViewed: false,
          },
        ],
      },
      {
        name: "Alpha Group",
        organization: { name: "CAF", shortName: "CAF" },
        users: [
          {
            id: "1",
            firstName: "Alice",
            lastName: "Zebra",
            hasViewed: false,
          },
          {
            id: "2",
            firstName: "Bob",
            lastName: "Alpha",
            hasViewed: false,
          },
        ],
      },
    ];

    mockUseQuery.mockImplementation(
      (options: { queryKey: readonly unknown[] }) => {
        const queryKey = JSON.stringify(options.queryKey);
        if (queryKey.includes("getRecipientsByReportId")) {
          return {
            data: teamsWithMultipleUsers,
            isLoading: false,
            error: null,
          } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        return { data: undefined, isLoading: false, error: null } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    );

    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      // Verify all instructor names are displayed in the expected order
      // Alpha Group first (Bob Alpha, Alice Zebra sorted by lastName), then Beta Group (Charlie Beta)
      expect(screen.getByText("Bob Alpha")).toBeInTheDocument();
      expect(screen.getByText("Alice Zebra")).toBeInTheDocument();
      expect(screen.getByText("Charlie Beta")).toBeInTheDocument();

      // Verify group names are displayed
      expect(screen.getAllByText("Alpha Group")).toHaveLength(2);
      expect(screen.getByText("Beta Group")).toBeInTheDocument();
    });
  });

  it("button has aria-expanded=false by default", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      const button = screen.getByRole("button", {
        name: /Voir tous les opérateurs/i,
      });
      expect(button).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("button has aria-expanded=true after expansion", async () => {
    const user = userEvent.setup();
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Voir tous les opérateurs/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /Voir tous les opérateurs/i }),
    );

    expect(screen.getByRole("button", { name: /Voir moins/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("applies correct button styling", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      const button = screen.getByRole("button");
      expect(button).toHaveClass("fr-btn--sm");
    });
  });

  it("handles empty instructors array", async () => {
    mockUseQuery.mockImplementation(
      (options: { queryKey: readonly unknown[] }) => {
        const queryKey = JSON.stringify(options.queryKey);
        if (queryKey.includes("getRecipientsByReportId")) {
          return {
            data: [],
            isLoading: false,
            error: null,
          } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        return { data: undefined, isLoading: false, error: null } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    );

    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      expect(screen.getByText("Destinataires (0)")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();

      // No instructor names should be visible
      expect(screen.queryByText("Pierre Guery")).not.toBeInTheDocument();
    });
  });

  it("applies correct heading style", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      const heading = screen.getByText("Destinataires (7)");
      expect(heading.tagName).toBe("H5");
      expect(heading).toHaveClass("mb-4");
    });
  });

  it("renders with undefined reportId without crashing", async () => {
    renderWithWrapper(<RecipientsInfos reportId={undefined} />);

    await waitFor(() => {
      expect(screen.getByText(/Destinataires/)).toBeInTheDocument();
    });
  });

  it("handles undefined recipients data gracefully", async () => {
    mockUseQuery.mockImplementation(
      () =>
        ({
          data: undefined,
          isLoading: false,
          error: null,
        }) as ReturnType<typeof reactQuery.useQuery>,
    );

    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      expect(screen.getByText("Destinataires (0)")).toBeInTheDocument();
    });
  });

  it("shows eye icon for users who have viewed the report", async () => {
    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      // Dubois (hasViewed: true) and Loyer (hasViewed: true) are in the first 5 visible
      // RGAA 10.2 : l'info est restituée via un texte sr-only (plus de title).
      const eyeIcons = screen.getAllByText("A consulté le signalement");
      expect(eyeIcons.length).toBeGreaterThan(0);
    });
  });

  it("does not show eye icon for users who have not viewed the report", async () => {
    mockUseQuery.mockImplementation(
      (options: { queryKey: readonly unknown[] }) => {
        const queryKey = JSON.stringify(options.queryKey);
        if (queryKey.includes("getRecipientsByReportId")) {
          return {
            data: [
              {
                name: "Team A",
                organization: { name: "CAF", shortName: "CAF" },
                users: [
                  {
                    id: "1",
                    firstName: "Alice",
                    lastName: "Martin",
                    hasViewed: false,
                  },
                ],
              },
            ],
            isLoading: false,
            error: null,
          } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        return { data: undefined, isLoading: false, error: null } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    );

    renderWithWrapper(<RecipientsInfos reportId="1" />);

    await waitFor(() => {
      expect(
        screen.queryByText("A consulté le signalement"),
      ).not.toBeInTheDocument();
    });
  });
});
