import { render, screen, fireEvent } from "@testing-library/react";
import { mockUseQuery } from "@/test/utils/global-mocks";
import { UserAnalyticsSection } from "./user-analytics-section";

const mockEventsQueryOptions = jest.fn((input: unknown) => ({
  queryKey: ["analytics", "getUserEvents", input],
}));
const mockCountsQueryOptions = jest.fn((input: unknown) => ({
  queryKey: ["analytics", "getUserEventCounts", input],
}));

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    analytics: {
      getUserEvents: {
        queryOptions: (input: unknown) => mockEventsQueryOptions(input),
      },
      getUserEventCounts: {
        queryOptions: (input: unknown) => mockCountsQueryOptions(input),
      },
    },
  }),
}));

// Le récap est testé séparément ; on l'isole ici pour ne pas dépendre de sa
// propre requête.
jest.mock("./user-activity-summary/user-activity-summary", () => ({
  UserActivitySummary: () => <div data-testid="activity-summary" />,
}));

const deactivationEvent = {
  id: "evt-1",
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  occurredAt: null,
  eventName: "user_deactivated",
  eventCategory: "user",
  pagePath: null,
  ipAddress: "1.2.3.4",
  userAgent: "Mozilla",
  metadata: { targetUserId: "user-1" },
  actorId: "admin-1",
  actorName: "Alice Admin",
  targetUserId: "user-1",
  targetName: "Bob User",
  isTarget: true,
};

const signInEvent = {
  id: "evt-2",
  createdAt: new Date("2026-06-30T08:00:00.000Z"),
  occurredAt: null,
  eventName: "auth_sign_in",
  eventCategory: "auth",
  pagePath: null,
  ipAddress: null,
  userAgent: null,
  metadata: { method: "email" },
  actorId: "user-1",
  actorName: "Bob User",
  targetUserId: null,
  targetName: null,
  isTarget: false,
};

const defaultCounts = {
  auth: 5,
  user: 2,
  report: 40,
  page_view: 210,
};

function mockQueries(
  items: unknown[],
  {
    total = items.length,
    totalPages = 1,
    counts = defaultCounts,
  }: {
    total?: number;
    totalPages?: number;
    counts?: Record<string, number>;
  } = {},
) {
  mockUseQuery.mockImplementation((options) => {
    const queryKey = JSON.stringify(options?.queryKey ?? []);
    if (queryKey.includes("getUserEventCounts")) {
      return { data: counts, isLoading: false, error: null };
    }
    return {
      data: { items, total, totalPages },
      isLoading: false,
      error: null,
    };
  });
}

describe("UserAnalyticsSection", () => {
  beforeEach(() => {
    mockQueries([deactivationEvent, signInEvent]);
  });

  it("renders readable French descriptions of the events", () => {
    render(<UserAnalyticsSection userId="user-1" />);

    expect(
      screen.getByText("Alice Admin a désactivé Bob User"),
    ).toBeInTheDocument();
    expect(screen.getByText("Connexion (email)")).toBeInTheDocument();
  });

  it("flags events where the user is the target with a badge", () => {
    render(<UserAnalyticsSection userId="user-1" />);

    expect(screen.getAllByText("Cible")).toHaveLength(1);
  });

  it("renders category filter chips with their counts", () => {
    render(<UserAnalyticsSection userId="user-1" />);

    // « Tout » = tous les événements sauf les pages consultées (5+2+40 = 47).
    expect(screen.getByRole("button", { name: /Tout 47/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Authentification 5/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Navigation 210/ }),
    ).toBeInTheDocument();
  });

  it("renders an empty state when there is no activity", () => {
    mockQueries([]);
    render(<UserAnalyticsSection userId="user-1" />);

    expect(
      screen.getByText("Aucune activité enregistrée pour cet utilisateur."),
    ).toBeInTheDocument();
  });

  it("excludes page views by default", () => {
    render(<UserAnalyticsSection userId="user-1" />);

    expect(mockEventsQueryOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        page: 1,
        includePageViews: false,
        category: undefined,
      }),
    );
  });

  it("filters by category when a chip is clicked and resets to page 1", () => {
    render(<UserAnalyticsSection userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Authentification/ }));

    expect(mockEventsQueryOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: "auth",
        page: 1,
        includePageViews: false,
      }),
    );
  });

  it("includes page views only when the Navigation chip is selected", () => {
    render(<UserAnalyticsSection userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Navigation/ }));

    expect(mockEventsQueryOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: "page_view",
        includePageViews: true,
      }),
    );
  });

  it("disables a category chip that has no event", () => {
    mockQueries([signInEvent], { counts: { auth: 5, file: 0 } });
    render(<UserAnalyticsSection userId="user-1" />);

    expect(screen.getByRole("button", { name: /Fichier 0/ })).toBeDisabled();
  });
});
