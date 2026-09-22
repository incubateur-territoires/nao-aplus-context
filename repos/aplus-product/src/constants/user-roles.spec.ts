import { USER_ROLES, type UserRole } from "./user-roles";

describe("USER_ROLES", () => {
  it("defines ADMIN role as lowercase 'admin'", () => {
    expect(USER_ROLES.ADMIN).toBe("admin");
  });

  it("defines USER role as lowercase 'user'", () => {
    expect(USER_ROLES.USER).toBe("user");
  });

  it("defines SUPERVISOR role as lowercase 'supervisor'", () => {
    expect(USER_ROLES.SUPERVISOR).toBe("supervisor");
  });

  it("has ADMIN, USER and SUPERVISOR roles", () => {
    const roleKeys = Object.keys(USER_ROLES);
    expect(roleKeys).toHaveLength(3);
    expect(roleKeys).toContain("ADMIN");
    expect(roleKeys).toContain("USER");
    expect(roleKeys).toContain("SUPERVISOR");
  });

  it("uses lowercase values for better-auth compatibility", () => {
    // better-auth expects lowercase role values in defaultRoles
    const allValues = Object.values(USER_ROLES);
    allValues.forEach((value) => {
      expect(value).toBe(value.toLowerCase());
    });
  });

  it("UserRole type matches USER_ROLES values", () => {
    // Type assertion to verify the type system works correctly
    const adminRole: UserRole = USER_ROLES.ADMIN;
    const userRole: UserRole = USER_ROLES.USER;
    const supervisorRole: UserRole = USER_ROLES.SUPERVISOR;

    expect(adminRole).toBe("admin");
    expect(userRole).toBe("user");
    expect(supervisorRole).toBe("supervisor");
  });
});
