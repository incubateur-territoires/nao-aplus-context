import { isAdminOrManager, getCurrentUserRole } from "@/utils/auth-server";
import { USER_ROLES } from "@/constants/user-roles";
import { NavigationClient } from "./navigation";

export async function Navigation() {
  const [canAccessUsers, role] = await Promise.all([
    isAdminOrManager(),
    getCurrentUserRole(),
  ]);

  const isAdmin = role === USER_ROLES.ADMIN;
  const isAuthenticated = role !== null;

  return (
    <NavigationClient
      canAccessUsers={canAccessUsers}
      isAdmin={isAdmin}
      isAuthenticated={isAuthenticated}
    />
  );
}
