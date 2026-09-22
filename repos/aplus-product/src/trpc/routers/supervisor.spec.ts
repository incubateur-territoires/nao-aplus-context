import { createCallerFactory } from "../init";
import { supervisorRouter } from "./supervisor";
import prisma from "@/lib/prisma";
import { createMockUser, MOCK_IDS, USER_ROLES } from "@/test/mocks";
import { sendTemplatedEmail } from "@/app/services/email/email.service";
import { createVerificationToken } from "@/utils/verification-token";

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => {
  const mock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    supervisor: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pendingSupervisor: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    pendingUser: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return { __esModule: true, default: mock, prisma: mock };
});

jest.mock("@/app/services/email/email.service", () => ({
  sendTemplatedEmail: jest.fn(),
}));

jest.mock("@/utils/verification-token", () => ({
  createVerificationToken: jest.fn(),
}));

const createCaller = createCallerFactory(supervisorRouter);

describe("supervisorRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateSupervisor", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.updateSupervisor({
          userId: MOCK_IDS.USER_2,
          areaIds: [MOCK_IDS.AREA_1],
          organizationIds: [MOCK_IDS.ORG_1],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(prisma.supervisor.findUnique).not.toHaveBeenCalled();
      expect(prisma.supervisor.update).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when supervisor does not exist", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.updateSupervisor({
          userId: MOCK_IDS.USER_2,
          areaIds: [],
          organizationIds: [],
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(prisma.supervisor.update).not.toHaveBeenCalled();
    });

    it("updates areas and organizations via set when supervisor exists", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        id: "sup-1",
        userId: MOCK_IDS.USER_2,
      });
      (prisma.supervisor.update as jest.Mock).mockResolvedValue({});

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.updateSupervisor({
        userId: MOCK_IDS.USER_2,
        areaIds: [MOCK_IDS.AREA_1, MOCK_IDS.AREA_2],
        organizationIds: [MOCK_IDS.ORG_1],
      });

      expect(result).toEqual({ success: true });
      expect(prisma.supervisor.findUnique).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_2 },
      });
      expect(prisma.supervisor.update).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_2 },
        data: {
          areas: {
            set: [{ id: MOCK_IDS.AREA_1 }, { id: MOCK_IDS.AREA_2 }],
          },
          organizations: {
            set: [{ id: MOCK_IDS.ORG_1 }],
          },
        },
      });
    });

    it("clears areas and organizations when empty arrays are provided", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        id: "sup-1",
        userId: MOCK_IDS.USER_2,
      });
      (prisma.supervisor.update as jest.Mock).mockResolvedValue({});

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.updateSupervisor({
        userId: MOCK_IDS.USER_2,
        areaIds: [],
        organizationIds: [],
      });

      expect(prisma.supervisor.update).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_2 },
        data: {
          areas: { set: [] },
          organizations: { set: [] },
        },
      });
    });

    it("uses default empty arrays when not provided", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        id: "sup-1",
        userId: MOCK_IDS.USER_2,
      });
      (prisma.supervisor.update as jest.Mock).mockResolvedValue({});

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await caller.updateSupervisor({
        userId: MOCK_IDS.USER_2,
      });

      expect(prisma.supervisor.update).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_2 },
        data: {
          areas: { set: [] },
          organizations: { set: [] },
        },
      });
    });
  });

  describe("createSupervisor", () => {
    it("throws FORBIDDEN when caller is not admin", async () => {
      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(
        caller.createSupervisor({
          email: "new@example.com",
          areaIds: [],
          organizationIds: [],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws CONFLICT when user is already a supervisor", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        email: "sup@example.com",
      });
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        id: "sup-1",
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.createSupervisor({
          email: "SUP@example.com",
          areaIds: [MOCK_IDS.AREA_1],
          organizationIds: [],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("creates supervisor in transaction when user exists and is not yet a supervisor", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MOCK_IDS.USER_2,
        email: "new@example.com",
      });
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);

      const expectedSupervisor = {
        id: "sup-new",
        userId: MOCK_IDS.USER_2,
        areas: [],
        organizations: [],
        user: {},
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (
          callback: (tx: {
            user: { update: jest.Mock };
            supervisor: { create: jest.Mock };
          }) => Promise<unknown>,
        ) => {
          const tx = {
            user: { update: jest.fn().mockResolvedValue({}) },
            supervisor: {
              create: jest.fn().mockResolvedValue(expectedSupervisor),
            },
          };
          const result = await callback(tx);
          return result;
        },
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.createSupervisor({
        email: "new@example.com",
        areaIds: [MOCK_IDS.AREA_1],
        organizationIds: [MOCK_IDS.ORG_1],
      });

      expect(result).toEqual(expectedSupervisor);
    });

    it("throws CONFLICT when pending supervisor already exists for email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.pendingSupervisor.findUnique as jest.Mock).mockResolvedValue({
        id: "pending-1",
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      await expect(
        caller.createSupervisor({
          email: "new@example.com",
          areaIds: [],
          organizationIds: [],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("creates pendingUser and pendingSupervisor + sends invitation email when user does not exist", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.pendingSupervisor.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (createVerificationToken as jest.Mock).mockResolvedValue("token-xyz");
      (prisma.pendingUser.upsert as jest.Mock).mockResolvedValue({
        email: "new@example.com",
        verificationToken: "token-xyz",
      });
      (prisma.pendingSupervisor.create as jest.Mock).mockResolvedValue({});
      (sendTemplatedEmail as jest.Mock).mockResolvedValue({ success: true });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.createSupervisor({
        email: "NEW@example.com",
        areaIds: [MOCK_IDS.AREA_1],
        organizationIds: [MOCK_IDS.ORG_1],
      });

      expect(result).toEqual({ pending: true, email: "new@example.com" });
      expect(prisma.pendingSupervisor.create).toHaveBeenCalledWith({
        data: {
          email: "new@example.com",
          areas: { connect: [{ id: MOCK_IDS.AREA_1 }] },
          organizations: { connect: [{ id: MOCK_IDS.ORG_1 }] },
        },
      });
      expect(sendTemplatedEmail).toHaveBeenCalledWith(
        "INVITE_SUPERVISOR",
        expect.objectContaining({
          to: [{ email: "new@example.com", name: "new@example.com" }],
        }),
      );
    });

    it("still returns pending success even if sending invitation email fails", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.pendingSupervisor.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (createVerificationToken as jest.Mock).mockResolvedValue("token-xyz");
      (prisma.pendingUser.upsert as jest.Mock).mockResolvedValue({
        email: "new@example.com",
        verificationToken: "token-xyz",
      });
      (prisma.pendingSupervisor.create as jest.Mock).mockResolvedValue({});
      (sendTemplatedEmail as jest.Mock).mockResolvedValue({
        success: false,
        error: "SMTP down",
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.createSupervisor({
        email: "new@example.com",
        areaIds: [],
        organizationIds: [],
      });

      expect(result).toEqual({ pending: true, email: "new@example.com" });
    });
  });
});
