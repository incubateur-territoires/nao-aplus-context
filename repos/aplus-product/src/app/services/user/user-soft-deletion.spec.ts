import { processSoftDeletion } from "./user-soft-deletion";

jest.mock("@/app/services/email/email.service", () => ({
  sendTemplatedEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/utils/auth-server", () => ({
  revokeUserSessions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/anonymize-user", () => ({
  buildAnonymizedUserData: jest.fn((userId: string) => ({
    firstName: "Anon",
    lastName: "Ymized",
    name: "Anon Ymized",
    email: `anonyme-${userId}@anonymized.local`,
    phone: null,
    profession: null,
    internalSupportComment: null,
  })),
}));

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function createMockPrisma() {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnValue({ __op: "user.update" }),
    },
    account: {
      updateMany: jest.fn().mockReturnValue({ __op: "account.updateMany" }),
    },
    twoFactor: {
      deleteMany: jest.fn().mockReturnValue({ __op: "twoFactor.deleteMany" }),
    },
    session: {
      deleteMany: jest.fn().mockReturnValue({ __op: "session.deleteMany" }),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

const baseUser = {
  id: "user-old",
  email: "old@example.com",
  firstName: "Old",
  lastName: "User",
  phone: "0600000000",
  profession: "Agent",
  internalSupportComment: "note interne",
};

describe("user-soft-deletion service", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  describe("processSoftDeletion", () => {
    it("should return empty results when no users to delete", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await processSoftDeletion(mockPrisma as never);

      expect(result.usersDeleted).toEqual([]);
      expect(result.emailErrors).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("should soft delete and pseudonymize user deactivated for more than 2 years", async () => {
      mockPrisma.user.findMany.mockResolvedValue([baseUser]);

      const result = await processSoftDeletion(mockPrisma as never);

      expect(result.usersDeleted).toContainEqual({
        id: "user-old",
        email: "old@example.com",
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-old" },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            firstName: "Anon",
            lastName: "Ymized",
            name: "Anon Ymized",
            email: "anonyme-user-old@anonymized.local",
            phone: null,
            profession: null,
            internalSupportComment: null,
          }),
        }),
      );
    });

    it("should scrub account credentials and remove sessions/2FA in a transaction", async () => {
      mockPrisma.user.findMany.mockResolvedValue([baseUser]);

      await processSoftDeletion(mockPrisma as never);

      expect(mockPrisma.account.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-old" },
        data: {
          accountId: "anonyme-user-old@anonymized.local",
          password: null,
        },
      });
      expect(mockPrisma.twoFactor.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-old" },
      });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-old" },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        { __op: "user.update" },
        { __op: "account.updateMany" },
        { __op: "twoFactor.deleteMany" },
        { __op: "session.deleteMany" },
      ]);
    });

    it("should send email notification on deletion", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          ...baseUser,
          id: "user-email",
          email: "email@example.com",
          firstName: "Email",
          lastName: "User",
        },
      ]);

      const { sendTemplatedEmail } = jest.requireMock(
        "@/app/services/email/email.service",
      );

      await processSoftDeletion(mockPrisma as never);

      expect(sendTemplatedEmail).toHaveBeenCalledWith(
        "ACCOUNT_DELETED",
        expect.objectContaining({
          to: [{ email: "email@example.com", name: "Email User" }],
          params: {},
        }),
      );
    });

    it("should still delete user when email fails", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { ...baseUser, id: "user-email-fail", email: "fail@example.com" },
      ]);

      const { sendTemplatedEmail } = jest.requireMock(
        "@/app/services/email/email.service",
      );
      sendTemplatedEmail.mockResolvedValueOnce({
        success: false,
        error: "Email service down",
      });

      const result = await processSoftDeletion(mockPrisma as never);

      expect(result.usersDeleted).toContainEqual({
        id: "user-email-fail",
        email: "fail@example.com",
      });
      expect(result.emailErrors).toContainEqual({
        userId: "user-email-fail",
        error: "Email service down",
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should not mark user as deleted when the transaction fails", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { ...baseUser, id: "user-db-fail", email: "dbfail@example.com" },
      ]);
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Error("Database error"),
      );

      const result = await processSoftDeletion(mockPrisma as never);

      expect(result.usersDeleted).toEqual([]);
      expect(result.errors).toContainEqual({
        userId: "user-db-fail",
        error: "Database error",
      });
    });

    it("should query users with correct filters", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await processSoftDeletion(mockPrisma as never);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          isInactive: { not: null },
          deletedAt: null,
          OR: [
            { lastActivityAt: { lte: expect.any(Date) } },
            { lastActivityAt: null, createdAt: { lte: expect.any(Date) } },
          ],
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          profession: true,
          internalSupportComment: true,
        },
      });

      // Verify the inactivity threshold is approximately 730 days ago
      const call = mockPrisma.user.findMany.mock.calls[0][0];
      const filterDate = call.where.OR[0].lastActivityAt.lte as Date;
      const expectedDate = daysAgo(730);
      const diffMs = Math.abs(filterDate.getTime() - expectedDate.getTime());
      expect(diffMs).toBeLessThan(1000); // Less than 1 second difference
    });
  });
});
