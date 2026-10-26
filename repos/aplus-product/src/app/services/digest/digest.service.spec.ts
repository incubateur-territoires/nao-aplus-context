import type { PrismaClient } from "@/generated/prisma/client";
import { NotificationFrequency } from "@/generated/prisma/enums";
import {
  processDigestForAllUsers,
  shouldReceiveDigestNow,
} from "./digest.service";
import type { UserDigestEligibility } from "./digest.types";

const mockSendTemplatedEmail = jest.fn();
jest.mock("@/app/services/email/email.service", () => ({
  sendTemplatedEmail: (...args: unknown[]) => mockSendTemplatedEmail(...args),
}));

const mockGetEligibleUsers = jest.fn();
const mockGetUnviewedContent = jest.fn();
jest.mock("./digest.queries", () => ({
  getEligibleUsersForDigest: (...args: unknown[]) =>
    mockGetEligibleUsers(...args),
  getUnviewedContentForUser: (...args: unknown[]) =>
    mockGetUnviewedContent(...args),
  updateLastDigestSentAt: jest.fn(),
}));

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

  describe("processDigestForAllUsers", () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    afterEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    });

    it("links the email to the reports list of the current environment", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://staging.exemple.test";
      mockGetEligibleUsers.mockResolvedValue([
        {
          userId: "user-1",
          email: "aidant@exemple.test",
          firstName: "Aidant",
          timezone: "Europe/Paris",
          lastDigestSentAt: null,
          notificationFrequency: NotificationFrequency.TWICE_DAILY,
        },
      ]);
      mockGetUnviewedContent.mockResolvedValue({
        unviewedReportsCount: 1,
        unviewedAnswersCount: 0,
        unviewedStatusChangesCount: 0,
      });
      mockSendTemplatedEmail.mockResolvedValue({ success: true });

      await processDigestForAllUsers({} as PrismaClient, { force: true });

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        "DIGEST",
        expect.objectContaining({
          params: expect.objectContaining({
            linkUrl: "https://staging.exemple.test/tous-les-signalements",
          }),
        }),
      );
    });
  });
});
