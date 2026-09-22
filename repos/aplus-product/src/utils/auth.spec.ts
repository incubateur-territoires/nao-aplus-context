import {
  isAdmin,
  isUser,
  isSupervisor,
  isTeamOperator,
  isTeamHelper,
  isOrganizationOperator,
  isOrganizationHelper,
  hasOperatorTeam,
  hasHelperTeam,
  getUserTeamRole,
} from "./auth";
import { USER_ROLES } from "@/constants/user-roles";
import { OrganizationRole } from "@/generated/prisma/enums";

describe("User role checks", () => {
  describe("isAdmin", () => {
    it("returns true for admin role", () => {
      expect(isAdmin(USER_ROLES.ADMIN)).toBe(true);
    });

    it("returns false for user role", () => {
      expect(isAdmin(USER_ROLES.USER)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isAdmin(undefined)).toBe(false);
    });

    it("works with lowercase 'admin' value", () => {
      // Verify that the function works with the actual lowercase value
      expect(isAdmin("admin")).toBe(true);
    });
  });

  describe("isUser", () => {
    it("returns true for user role", () => {
      expect(isUser(USER_ROLES.USER)).toBe(true);
    });

    it("returns false for admin role", () => {
      expect(isUser(USER_ROLES.ADMIN)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isUser(undefined)).toBe(false);
    });

    it("works with lowercase 'user' value", () => {
      // Verify that the function works with the actual lowercase value
      expect(isUser("user")).toBe(true);
    });
  });

  describe("isSupervisor", () => {
    it("returns true for supervisor role", () => {
      expect(isSupervisor(USER_ROLES.SUPERVISOR)).toBe(true);
    });

    it("returns false for admin role", () => {
      expect(isSupervisor(USER_ROLES.ADMIN)).toBe(false);
    });

    it("returns false for user role", () => {
      expect(isSupervisor(USER_ROLES.USER)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isSupervisor(undefined)).toBe(false);
    });

    it("works with lowercase 'supervisor' value", () => {
      expect(isSupervisor("supervisor")).toBe(true);
    });
  });
});

describe("Team role checks", () => {
  describe("isTeamOperator", () => {
    it("returns true for OPERATOR team", () => {
      expect(isTeamOperator({ role: OrganizationRole.OPERATOR })).toBe(true);
    });

    it("returns false for HELPER team", () => {
      expect(isTeamOperator({ role: OrganizationRole.HELPER })).toBe(false);
    });

    it("returns false for null team", () => {
      expect(isTeamOperator(null)).toBe(false);
    });

    it("returns false for undefined team", () => {
      expect(isTeamOperator(undefined)).toBe(false);
    });
  });

  describe("isTeamHelper", () => {
    it("returns true for HELPER team", () => {
      expect(isTeamHelper({ role: OrganizationRole.HELPER })).toBe(true);
    });

    it("returns false for OPERATOR team", () => {
      expect(isTeamHelper({ role: OrganizationRole.OPERATOR })).toBe(false);
    });

    it("returns false for null team", () => {
      expect(isTeamHelper(null)).toBe(false);
    });
  });
});

describe("Organization role checks", () => {
  describe("isOrganizationOperator", () => {
    it("returns true for OPERATOR organization", () => {
      expect(isOrganizationOperator({ role: OrganizationRole.OPERATOR })).toBe(
        true,
      );
    });

    it("returns false for HELPER organization", () => {
      expect(isOrganizationOperator({ role: OrganizationRole.HELPER })).toBe(
        false,
      );
    });

    it("returns false for null organization", () => {
      expect(isOrganizationOperator(null)).toBe(false);
    });
  });

  describe("isOrganizationHelper", () => {
    it("returns true for HELPER organization", () => {
      expect(isOrganizationHelper({ role: OrganizationRole.HELPER })).toBe(
        true,
      );
    });

    it("returns false for OPERATOR organization", () => {
      expect(isOrganizationHelper({ role: OrganizationRole.OPERATOR })).toBe(
        false,
      );
    });
  });
});

describe("User team role checks", () => {
  describe("hasOperatorTeam", () => {
    it("returns true when user has at least one OPERATOR team", () => {
      const user = {
        teams: [
          { role: OrganizationRole.HELPER },
          { role: OrganizationRole.OPERATOR },
        ],
      };
      expect(hasOperatorTeam(user)).toBe(true);
    });

    it("returns false when user has only HELPER teams", () => {
      const user = {
        teams: [
          { role: OrganizationRole.HELPER },
          { role: OrganizationRole.HELPER },
        ],
      };
      expect(hasOperatorTeam(user)).toBe(false);
    });

    it("returns false for null user", () => {
      expect(hasOperatorTeam(null)).toBe(false);
    });

    it("returns false for undefined user", () => {
      expect(hasOperatorTeam(undefined)).toBe(false);
    });

    it("returns false for user with empty teams", () => {
      expect(hasOperatorTeam({ teams: [] })).toBe(false);
    });
  });

  describe("hasHelperTeam", () => {
    it("returns true when user has at least one HELPER team", () => {
      const user = {
        teams: [
          { role: OrganizationRole.OPERATOR },
          { role: OrganizationRole.HELPER },
        ],
      };
      expect(hasHelperTeam(user)).toBe(true);
    });

    it("returns false when user has only OPERATOR teams", () => {
      const user = {
        teams: [
          { role: OrganizationRole.OPERATOR },
          { role: OrganizationRole.OPERATOR },
        ],
      };
      expect(hasHelperTeam(user)).toBe(false);
    });

    it("returns false for null user", () => {
      expect(hasHelperTeam(null)).toBe(false);
    });
  });

  describe("getUserTeamRole", () => {
    it("returns the role for an existing team", () => {
      const user = {
        teams: [
          { id: "team-1", role: OrganizationRole.HELPER },
          { id: "team-2", role: OrganizationRole.OPERATOR },
        ],
      };
      expect(getUserTeamRole(user, "team-2")).toBe(OrganizationRole.OPERATOR);
    });

    it("returns null for non-existing team", () => {
      const user = {
        teams: [{ id: "team-1", role: OrganizationRole.HELPER }],
      };
      expect(getUserTeamRole(user, "non-existing")).toBe(null);
    });

    it("returns null for null user", () => {
      expect(getUserTeamRole(null, "team-1")).toBe(null);
    });

    it("returns null for undefined user", () => {
      expect(getUserTeamRole(undefined, "team-1")).toBe(null);
    });
  });
});
