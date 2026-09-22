import {
  PostgresAnalyticsProvider,
  extractTargetUserId,
} from "./postgres-analytics";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    analyticsEvent: {
      createMany: jest.fn(),
    },
  },
}));

describe("extractTargetUserId", () => {
  it("extracts targetUserId from metadata", () => {
    expect(extractTargetUserId({ targetUserId: "user-2" })).toBe("user-2");
  });

  it("extracts removedUserId from metadata (team_member_removed)", () => {
    expect(extractTargetUserId({ removedUserId: "user-3" })).toBe("user-3");
  });

  it("prefers targetUserId over removedUserId", () => {
    expect(
      extractTargetUserId({ targetUserId: "user-2", removedUserId: "user-3" }),
    ).toBe("user-2");
  });

  it("returns null when metadata is missing or has no target", () => {
    expect(extractTargetUserId(null)).toBeNull();
    expect(extractTargetUserId(undefined)).toBeNull();
    expect(extractTargetUserId({})).toBeNull();
    expect(extractTargetUserId({ targetUserId: 42 })).toBeNull();
  });
});

describe("PostgresAnalyticsProvider.flush", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists targetUserId extracted from metadata", async () => {
    const provider = new PostgresAnalyticsProvider();
    await provider.trackEvent({
      eventName: "user_deactivated",
      eventCategory: "user",
      userId: "admin-1",
      metadata: { targetUserId: "user-2" },
    });
    await provider.flush();
    provider.destroy();

    expect(prisma.analyticsEvent.createMany).toHaveBeenCalledTimes(1);
    const { data } = (prisma.analyticsEvent.createMany as jest.Mock).mock
      .calls[0][0];
    expect(data[0]).toMatchObject({
      eventName: "user_deactivated",
      userId: "admin-1",
      targetUserId: "user-2",
    });
  });

  it("persists null targetUserId when metadata has no target", async () => {
    const provider = new PostgresAnalyticsProvider();
    await provider.trackEvent({
      eventName: "auth_sign_in",
      eventCategory: "auth",
      userId: "user-1",
      metadata: { method: "email" },
    });
    await provider.flush();
    provider.destroy();

    const { data } = (prisma.analyticsEvent.createMany as jest.Mock).mock
      .calls[0][0];
    expect(data[0].targetUserId).toBeNull();
  });
});
