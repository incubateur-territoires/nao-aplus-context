"use client";

import {
  customSessionClient,
  adminClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import type { auth } from "@/lib/auth"; // Import the auth instance as a type
import type { UserRole } from "@/constants/user-roles";

import { createAuthClient } from "better-auth/react"; // make sure to import from better-auth/react

// Extended user type matching the customSession plugin output
export interface AuthClientUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  role: UserRole;
  twoFactorEnabled: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

// Extended session type with impersonation info
export interface AuthClientSession {
  user: AuthClientUser | null;
  impersonatedBy: string | null;
}

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/auth",
  plugins: [
    customSessionClient<typeof auth>(),
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        // Conserver la destination initiale (returnTo) à travers l'étape 2FA.
        const returnTo = new URLSearchParams(window.location.search).get(
          "returnTo",
        );
        window.location.href = returnTo
          ? `/verification-2fa?returnTo=${encodeURIComponent(returnTo)}`
          : "/verification-2fa";
      },
    }),
  ],
});

const { signIn, signOut, useSession: useSessionOriginal } = authClient;

// Re-export with proper typing
export { signIn, signOut };

// Export admin functions for impersonation
export const { admin } = authClient;

// Typed useSession hook
export function useSession() {
  const result = useSessionOriginal();
  return {
    ...result,
    data: result.data as AuthClientSession | null,
  };
}
