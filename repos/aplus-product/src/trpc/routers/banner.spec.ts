import { createCallerFactory } from "../init";
import { bannerRouter } from "./banner";
import prisma from "@/lib/prisma";
import { createMockUser, USER_ROLES } from "@/test/mocks";

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    siteBanner: {
      findFirst: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const createCaller = createCallerFactory(bannerRouter);

describe("bannerRouter", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("delete", () => {
    it("throws UNAUTHORIZED when user is not logged in", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.delete()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("throws FORBIDDEN when user is not admin", async () => {
      const caller = createCaller({
        userId: "user-1",
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      await expect(caller.delete()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("returns null when there is no active banner", async () => {
      (prisma.siteBanner.findFirst as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: "admin-1",
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.delete();

      expect(result).toBeNull();
      expect(prisma.siteBanner.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      expect(prisma.siteBanner.delete).not.toHaveBeenCalled();
    });

    it("deletes active banner in database", async () => {
      const activeBanner = {
        id: "banner-1",
        severity: "info",
        content: "Bandeau actif",
        isActive: true,
        authorId: "admin-1",
        createdAt: new Date("2026-02-27T10:00:00.000Z"),
        updatedAt: new Date("2026-02-27T10:00:00.000Z"),
      };

      const deletedBanner = {
        ...activeBanner,
      };

      (prisma.siteBanner.findFirst as jest.Mock).mockResolvedValue(
        activeBanner,
      );
      (prisma.siteBanner.delete as jest.Mock).mockResolvedValue(deletedBanner);

      const caller = createCaller({
        userId: "admin-1",
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.delete();

      expect(prisma.siteBanner.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      expect(prisma.siteBanner.delete).toHaveBeenCalledWith({
        where: { id: "banner-1" },
      });
      expect(result).toEqual(deletedBanner);
    });
  });
});
