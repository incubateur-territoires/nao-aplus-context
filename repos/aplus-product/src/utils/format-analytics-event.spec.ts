import {
  EVENT_CATEGORY_LABELS,
  formatAnalyticsEventDescription,
  getEventCategoryLabel,
} from "./format-analytics-event";

describe("getEventCategoryLabel", () => {
  it("returns the French label for a known category", () => {
    expect(getEventCategoryLabel("auth")).toBe("Authentification");
    expect(getEventCategoryLabel("page_view")).toBe("Navigation");
  });

  it("returns the raw category when unknown", () => {
    expect(getEventCategoryLabel("unknown_category")).toBe("unknown_category");
  });

  it("has a label for every category", () => {
    expect(Object.keys(EVENT_CATEGORY_LABELS)).toHaveLength(8);
  });
});

describe("formatAnalyticsEventDescription", () => {
  it("describes user_deactivated with actor and target names", () => {
    const result = formatAnalyticsEventDescription({
      eventName: "user_deactivated",
      metadata: { targetUserId: "user-2" },
      actorName: "Alice Admin",
      targetName: "Bob User",
    });

    expect(result).toBe("Alice Admin a désactivé Bob User");
  });

  it("falls back to targetEmail when target name is unknown", () => {
    const result = formatAnalyticsEventDescription({
      eventName: "auth_impersonate_user",
      metadata: { targetUserId: "user-2", targetEmail: "bob@example.com" },
      actorName: "Alice Admin",
      targetName: null,
    });

    expect(result).toBe(
      "Alice Admin a pris le contrôle du compte de bob@example.com",
    );
  });

  it("falls back to generic names when actor and target are unknown", () => {
    const result = formatAnalyticsEventDescription({
      eventName: "user_reactivated",
      metadata: null,
      actorName: null,
      targetName: null,
    });

    expect(result).toBe(
      "Un utilisateur inconnu a réactivé un utilisateur inconnu",
    );
  });

  it("describes report_status_changed with old and new statuses", () => {
    const result = formatAnalyticsEventDescription({
      eventName: "report_status_changed",
      metadata: { oldStatus: "IN_TREATMENT", newStatus: "COMPLETED" },
      actorName: "Alice Admin",
      targetName: null,
    });

    expect(result).toBe(
      "Statut du signalement modifié : IN_TREATMENT → COMPLETED",
    );
  });

  it("describes users_searched with query and results count", () => {
    const result = formatAnalyticsEventDescription({
      eventName: "users_searched",
      metadata: { query: "dupont", resultsCount: 3 },
      actorName: null,
      targetName: null,
    });

    expect(result).toBe("Recherche d'utilisateurs : « dupont » (3 résultats)");
  });

  it("describes user_admin_updated with updated fields", () => {
    const result = formatAnalyticsEventDescription({
      eventName: "user_admin_updated",
      metadata: {
        targetUserId: "user-2",
        fieldsUpdated: ["email", "firstName"],
      },
      actorName: "Alice Admin",
      targetName: "Bob User",
    });

    expect(result).toBe(
      "Alice Admin a modifié le profil de Bob User (champs : email, firstName)",
    );
  });

  it("ignores malformed metadata", () => {
    const result = formatAnalyticsEventDescription({
      eventName: "report_created",
      metadata: { numFiles: "pas un nombre", numTeams: null },
      actorName: null,
      targetName: null,
    });

    expect(result).toBe("Signalement créé");
  });

  it("returns the raw event name for unknown events", () => {
    const result = formatAnalyticsEventDescription({
      eventName: "some_future_event",
      metadata: null,
      actorName: null,
      targetName: null,
    });

    expect(result).toBe("some_future_event");
  });
});
