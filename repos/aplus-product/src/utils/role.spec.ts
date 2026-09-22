import { USER_ROLES } from "@/constants/user-roles";
import { OrganizationRole } from "@/generated/prisma/enums";

// Mock prisma before importing role.ts (which imports prisma)
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { getUserRoleLabel, getOrganizationRoleLabel } from "./role";

describe("getUserRoleLabel", () => {
  it("returns 'Administrateur' for admin role", () => {
    expect(getUserRoleLabel(USER_ROLES.ADMIN)).toBe("Administrateur");
  });

  it("returns 'Utilisateur' for user role", () => {
    expect(getUserRoleLabel(USER_ROLES.USER)).toBe("Utilisateur");
  });

  it("returns 'Superviseur' for supervisor role", () => {
    expect(getUserRoleLabel(USER_ROLES.SUPERVISOR)).toBe("Superviseur");
  });

  it("returns 'Utilisateur' for unknown role", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getUserRoleLabel("unknown" as any)).toBe("Utilisateur");
  });

  it("handles lowercase role values correctly", () => {
    // Ensure the function works with lowercase values (better-auth format)
    expect(getUserRoleLabel("admin")).toBe("Administrateur");
    expect(getUserRoleLabel("user")).toBe("Utilisateur");
    expect(getUserRoleLabel("supervisor")).toBe("Superviseur");
  });
});

describe("getOrganizationRoleLabel", () => {
  it("returns 'Aidant' for HELPER role", () => {
    expect(getOrganizationRoleLabel(OrganizationRole.HELPER)).toBe("Aidant");
  });

  it("returns 'Opérateur' for OPERATOR role", () => {
    expect(getOrganizationRoleLabel(OrganizationRole.OPERATOR)).toBe(
      "Opérateur",
    );
  });

  it("returns 'Aidant' for unknown role", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getOrganizationRoleLabel("unknown" as any)).toBe("Aidant");
  });
});
