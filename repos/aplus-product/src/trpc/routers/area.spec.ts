import { createCallerFactory } from "../init";
import { areaRouter } from "./area";
import prisma from "@/lib/prisma";
import {
  createMockUser,
  createMockArea,
  MOCK_IDS,
  USER_ROLES,
} from "@/test/mocks";

jest.mock("../middleware/authorization", () => ({
  checkReportAccess: jest.fn(),
  checkTeamAccess: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/prisma", () => {
  const mock = {
    area: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    supervisor: {
      findUnique: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
    },
  };
  return { __esModule: true, default: mock, prisma: mock };
});

const createCaller = createCallerFactory(areaRouter);

describe("areaRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMyAreas", () => {
    it("returns supervisor areas from supervisor scope", async () => {
      const supervisorAreas = [
        createMockArea({ id: MOCK_IDS.AREA_1, name: "Aisne" }),
        createMockArea({ id: MOCK_IDS.AREA_2, name: "Oise" }),
      ];
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue({
        areas: supervisorAreas,
      });

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.getMyAreas();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Aisne");
      expect(result[1].name).toBe("Oise");
      expect(prisma.supervisor.findUnique).toHaveBeenCalledWith({
        where: { userId: MOCK_IDS.USER_1 },
        include: { areas: true },
      });
    });

    it("returns empty array when supervisor has no scope", async () => {
      (prisma.supervisor.findUnique as jest.Mock).mockResolvedValue(null);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.SUPERVISOR }),
      });

      const result = await caller.getMyAreas();

      expect(result).toEqual([]);
    });

    it("returns all areas for admin", async () => {
      const allAreas = [
        createMockArea({ id: MOCK_IDS.AREA_1, name: "Aisne" }),
        createMockArea({ id: MOCK_IDS.AREA_2, name: "Oise" }),
      ];
      (prisma.area.findMany as jest.Mock).mockResolvedValue(allAreas);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.getMyAreas();

      expect(result).toHaveLength(2);
      expect(prisma.area.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
      });
    });

    it("returns managed team areas for manager", async () => {
      const area1 = createMockArea({ id: MOCK_IDS.AREA_1, name: "Aisne" });
      const area2 = createMockArea({ id: MOCK_IDS.AREA_2, name: "Oise" });
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { areas: [area1, area2] },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyAreas();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Aisne");
      expect(result[1].name).toBe("Oise");
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: {
          managers: { some: { id: MOCK_IDS.USER_1 } },
          deletedAt: null,
        },
        select: { areas: true },
      });
    });

    it("deduplicates areas across multiple managed teams", async () => {
      const area1 = createMockArea({ id: MOCK_IDS.AREA_1, name: "Aisne" });
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { areas: [area1] },
        { areas: [area1] },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyAreas();

      expect(result).toHaveLength(1);
    });

    it("returns empty array for non-manager regular user", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyAreas();

      expect(result).toEqual([]);
    });
  });
});
