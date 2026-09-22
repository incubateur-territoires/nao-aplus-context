import { render, screen } from "@testing-library/react";
import { mockUseQuery } from "@/test/utils/global-mocks";
import { UserActivitySummary } from "./user-activity-summary";

jest.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    analytics: {
      getUserActivitySummary: {
        queryOptions: (input: unknown) => ({
          queryKey: ["analytics", "getUserActivitySummary", input],
        }),
      },
    },
  }),
}));

function mockSummary(data: unknown) {
  mockUseQuery.mockImplementation(() => ({
    data,
    isLoading: false,
    error: null,
  }));
}

const baseSummary = {
  lastSignInAt: new Date("2026-07-03T14:00:00.000Z"),
  lastSignInBrowser: null,
  lastActivityAt: null,
  accountCreatedAt: new Date("2026-01-10T09:00:00.000Z"),
  reportsCreatedCount: 0,
  lastDeactivation: null,
  lastReactivation: null,
};

describe("UserActivitySummary", () => {
  it("renders nothing while data is loading", () => {
    mockSummary(undefined);
    const { container } = render(
      <UserActivitySummary userId="user-1" timeZone="Europe/Paris" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows last sign-in and account creation dates", () => {
    mockSummary(baseSummary);
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    expect(screen.getByText(/Dernière connexion le/)).toBeInTheDocument();
    expect(screen.getByText(/Compte créé le/)).toBeInTheDocument();
  });

  it("shows the browser used for the last sign-in when known", () => {
    mockSummary({ ...baseSummary, lastSignInBrowser: "Chrome sur macOS" });
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    expect(
      screen.getByText(/Dernière connexion le .* depuis Chrome sur macOS/),
    ).toBeInTheDocument();
  });

  it("shows no connection line at all when no sign-in is known", () => {
    mockSummary({ ...baseSummary, lastSignInAt: null });
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    // Aucune ligne de connexion : ni une date, ni « jamais connecté » (une
    // absence d'event ne prouve pas que l'utilisateur ne s'est jamais connecté).
    expect(screen.queryByText(/Dernière connexion/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Ne s'est jamais connecté/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Aucune connexion enregistrée/),
    ).not.toBeInTheDocument();
  });

  it("still shows the other facts when no sign-in is known", () => {
    mockSummary({
      ...baseSummary,
      lastSignInAt: null,
      reportsCreatedCount: 2,
    });
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    expect(screen.queryByText(/Dernière connexion/)).not.toBeInTheDocument();
    expect(screen.getByText("2 signalements créés.")).toBeInTheDocument();
  });

  it("shows the last activity date when known", () => {
    mockSummary({
      ...baseSummary,
      lastActivityAt: new Date("2026-07-06T08:00:00.000Z"),
    });
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    expect(screen.getByText(/Dernière activité le/)).toBeInTheDocument();
  });

  it("shows who deactivated the account and when", () => {
    mockSummary({
      ...baseSummary,
      lastDeactivation: {
        at: new Date("2026-07-04T10:00:00.000Z"),
        actorName: "Alice Admin",
      },
    });
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    expect(
      screen.getByText(/Compte désactivé par Alice Admin le/),
    ).toBeInTheDocument();
  });

  it("shows the reactivation when it is more recent than the deactivation", () => {
    mockSummary({
      ...baseSummary,
      lastDeactivation: {
        at: new Date("2026-07-01T10:00:00.000Z"),
        actorName: "Alice Admin",
      },
      lastReactivation: {
        at: new Date("2026-07-05T10:00:00.000Z"),
        actorName: "Bob Manager",
      },
    });
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    expect(
      screen.getByText(/Compte réactivé par Bob Manager le/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Compte désactivé/)).not.toBeInTheDocument();
  });

  it("falls back to a generic actor label when the name is unknown", () => {
    mockSummary({
      ...baseSummary,
      lastDeactivation: {
        at: new Date("2026-07-04T10:00:00.000Z"),
        actorName: null,
      },
    });
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    expect(
      screen.getByText(/Compte désactivé par un utilisateur inconnu le/),
    ).toBeInTheDocument();
  });

  it("shows the number of reports created", () => {
    mockSummary({ ...baseSummary, reportsCreatedCount: 3 });
    render(<UserActivitySummary userId="user-1" timeZone="Europe/Paris" />);

    expect(screen.getByText("3 signalements créés.")).toBeInTheDocument();
  });
});
