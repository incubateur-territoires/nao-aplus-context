import { createCallerFactory } from "../init";
import { organizationRouter } from "./organization";
import prisma from "@/lib/prisma";
import { OrganizationRole, TeamType } from "@/generated/prisma/enums";
import { createMockUser, MOCK_IDS, MOCK_DATES, USER_ROLES } from "@/test/mocks";

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
    organization: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
    },
  },
}));

const createCaller = createCallerFactory(organizationRouter);

const mockOrganization1 = {
  id: MOCK_IDS.ORG_1,
  name: "France Services",
  shortName: "FS",
  id_v1: "org-1-v1",
  createdAt: MOCK_DATES.JAN_1_2024,
  updatedAt: MOCK_DATES.JAN_1_2024,
  role: OrganizationRole.HELPER,
  type: TeamType.FRANCE_SERVICE,
  additionalInformation: null,
};

const mockOrganization2 = {
  id: "org-2",
  name: "Préfecture",
  shortName: "PREF",
  id_v1: "org-2-v1",
  createdAt: MOCK_DATES.JAN_1_2024,
  updatedAt: MOCK_DATES.JAN_1_2024,
  role: OrganizationRole.OPERATOR,
  type: TeamType.OPERATOR,
  additionalInformation: null,
};

describe("organizationRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrganizations", () => {
    it("returns all organizations", async () => {
      const mockOrganizations = [mockOrganization1, mockOrganization2];
      (prisma.organization.findMany as jest.Mock).mockResolvedValue(
        mockOrganizations,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getOrganizations();

      expect(result).toEqual(mockOrganizations);
      expect(prisma.organization.findMany).toHaveBeenCalled();
    });
  });

  describe("getMyOrganizations", () => {
    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({
        userId: null,
        user: null,
      });

      await expect(caller.getMyOrganizations()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it("returns all organizations for admin users", async () => {
      const mockOrganizations = [mockOrganization1, mockOrganization2];
      (prisma.organization.findMany as jest.Mock).mockResolvedValue(
        mockOrganizations,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      const result = await caller.getMyOrganizations();

      expect(result).toEqual(mockOrganizations);
      expect(prisma.organization.findMany).toHaveBeenCalled();
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    });

    it("returns unique organizations from user teams for non-admin users", async () => {
      const mockTeams = [
        {
          id: MOCK_IDS.TEAM_1,
          organization: mockOrganization1,
        },
        {
          id: MOCK_IDS.TEAM_2,
          organization: mockOrganization2,
        },
      ];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyOrganizations();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(mockOrganization1);
      expect(result).toContainEqual(mockOrganization2);
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, users: { some: { id: MOCK_IDS.USER_1 } } },
        include: { organization: true },
      });
      expect(prisma.organization.findMany).not.toHaveBeenCalled();
    });

    it("deduplicates organizations when user is in multiple teams with same org", async () => {
      const mockTeams = [
        {
          id: MOCK_IDS.TEAM_1,
          organization: mockOrganization1,
        },
        {
          id: MOCK_IDS.TEAM_2,
          organization: mockOrganization1, // Same org
        },
      ];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyOrganizations();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockOrganization1);
    });

    it("sorts organizations alphabetically by name", async () => {
      const mockTeams = [
        {
          id: MOCK_IDS.TEAM_1,
          organization: mockOrganization2, // Préfecture (P comes after F)
        },
        {
          id: MOCK_IDS.TEAM_2,
          organization: mockOrganization1, // France Services
        },
      ];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyOrganizations();

      expect(result[0].name).toBe("France Services");
      expect(result[1].name).toBe("Préfecture");
    });
  });

  describe("getMyManagedOrganizations", () => {
    it("throws UNAUTHORIZED when userId is not in context", async () => {
      const caller = createCaller({ userId: null, user: null });

      await expect(caller.getMyManagedOrganizations()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("returns all organizations for admin users", async () => {
      const mockOrganizations = [mockOrganization1, mockOrganization2];
      (prisma.organization.findMany as jest.Mock).mockResolvedValue(
        mockOrganizations,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.ADMIN }),
      });

      expect(await caller.getMyManagedOrganizations()).toEqual(
        mockOrganizations,
      );
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    });

    it("only returns organizations of teams the user manages", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([
        { id: MOCK_IDS.TEAM_1, organization: mockOrganization1 },
      ]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      const result = await caller.getMyManagedOrganizations();

      expect(result).toEqual([mockOrganization1]);
      // Le critère est la gestion, pas la simple appartenance : sinon la liste
      // proposerait une organisation que la garde serveur refuserait ensuite.
      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            managers: { some: { id: MOCK_IDS.USER_1 } },
            deletedAt: null,
          },
        }),
      );
    });

    it("returns an empty list when the user manages nothing", async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser({ role: USER_ROLES.USER }),
      });

      expect(await caller.getMyManagedOrganizations()).toEqual([]);
    });
  });

  describe("getOrganizationById", () => {
    it("returns organization by id", async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(
        mockOrganization1,
      );

      const caller = createCaller({
        userId: MOCK_IDS.USER_1,
        user: createMockUser(),
      });

      const result = await caller.getOrganizationById(MOCK_IDS.ORG_1);

      expect(result).toEqual(mockOrganization1);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: MOCK_IDS.ORG_1 },
      });
    });
  });
});
