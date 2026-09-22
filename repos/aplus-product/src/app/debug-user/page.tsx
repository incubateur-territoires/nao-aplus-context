"use client";

import { USER_ROLES } from "@/constants/user-roles";
import { useSession } from "@/app/component/auth-provider/auth-provider";

export default function DebugUserPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session?.user) {
    return <div>Not logged in</div>;
  }

  return (
    <div className="p-8">
      <h1>Debug User Info</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(
          {
            user: session.user,
            role: session.user.role,
            isAdmin: session.user.role === USER_ROLES.ADMIN,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
