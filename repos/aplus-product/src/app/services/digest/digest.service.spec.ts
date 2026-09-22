import { NotificationFrequency } from "@/generated/prisma/enums";
import { shouldReceiveDigestNow } from "./digest.service";
import type { UserDigestEligibility } from "./digest.types";

describe("digest.service", () => {
  describe("shouldReceiveDigestNow", () => {
    function createTestUser(
      overrides: Partial<UserDigestEligibility> = {},
    ): UserDigestEligibility {
      return {
        userId: "test-user-id",
        email: "test@example.com",
        firstName: "Test",
        timezone: "UTC",
        lastDigestSentAt: null,
        notificationFrequency: NotificationFrequency.TWICE_DAILY,
        ...overrides,
      };
    }

    describe("TWICE_DAILY users", () => {
      it("should return true at 11h UTC for UTC timezone user", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
          timezone: "UTC",
        });

        const nowAt11hUTC = new Date("2024-01-15T11:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt11hUTC)).toBe(true);
      });

      it("should return true at 15h UTC for UTC timezone user", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
          timezone: "UTC",
        });

        const nowAt15hUTC = new Date("2024-01-15T15:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt15hUTC)).toBe(true);
      });

      it("should return false at 10h UTC for UTC timezone user", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
          timezone: "UTC",
        });

        const nowAt10hUTC = new Date("2024-01-15T10:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt10hUTC)).toBe(false);
      });

      it("should return false at 14h UTC for UTC timezone user", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
          timezone: "UTC",
        });

        const nowAt14hUTC = new Date("2024-01-15T14:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt14hUTC)).toBe(false);
      });
    });

    describe("ONCE_DAILY users", () => {
      it("should return true at 11h UTC for UTC timezone user", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.ONCE_DAILY,
          timezone: "UTC",
        });

        const nowAt11hUTC = new Date("2024-01-15T11:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt11hUTC)).toBe(true);
      });

      it("should return false at 15h UTC for UTC timezone user", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.ONCE_DAILY,
          timezone: "UTC",
        });

        const nowAt15hUTC = new Date("2024-01-15T15:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt15hUTC)).toBe(false);
      });
    });

    describe("EACH_SOLICITATION users", () => {
      it("should always return false", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.EACH_SOLICITATION,
          timezone: "UTC",
        });

        const nowAt11hUTC = new Date("2024-01-15T11:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt11hUTC)).toBe(false);

        const nowAt15hUTC = new Date("2024-01-15T15:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt15hUTC)).toBe(false);
      });
    });

    describe("NONE users", () => {
      it("should always return false", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.NONE,
          timezone: "UTC",
        });

        const nowAt11hUTC = new Date("2024-01-15T11:30:00Z");
        expect(shouldReceiveDigestNow(user, nowAt11hUTC)).toBe(false);
      });
    });

    describe("timezone handling", () => {
      it("should convert UTC time to local timezone", () => {
        const userParis = createTestUser({
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
          timezone: "Europe/Paris",
        });

        // 10:00 UTC = 11:00 Paris (winter time, UTC+1)
        const nowAt10hUTC = new Date("2024-01-15T10:00:00Z");
        expect(shouldReceiveDigestNow(userParis, nowAt10hUTC)).toBe(true);
      });

      it("should handle different timezones correctly", () => {
        const userNY = createTestUser({
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
          timezone: "America/New_York",
        });

        // 16:00 UTC = 11:00 New York (winter time, UTC-5)
        const nowAt16hUTC = new Date("2024-01-15T16:00:00Z");
        expect(shouldReceiveDigestNow(userNY, nowAt16hUTC)).toBe(true);
      });

      it("should default to Europe/Paris for invalid timezones", () => {
        const user = createTestUser({
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
          timezone: "Invalid/Timezone",
        });

        // 10:00 UTC = 11:00 Paris (winter time, UTC+1)
        const nowAt10hUTC = new Date("2024-01-15T10:00:00Z");
        expect(shouldReceiveDigestNow(user, nowAt10hUTC)).toBe(true);
      });
    });
  });
});
