import { USER_ROLES } from "@/constants/user-roles";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AdminContent } from "./admin-content/admin-content";
import { UserContent } from "./user-content/user-content";

export async function TeamsContent() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const user = session?.user;
  if (user?.role === USER_ROLES.ADMIN) {
    return <AdminContent />;
  }
  if (user?.role === USER_ROLES.SUPERVISOR) {
    return <AdminContent />;
  }
  return <UserContent />;
}
