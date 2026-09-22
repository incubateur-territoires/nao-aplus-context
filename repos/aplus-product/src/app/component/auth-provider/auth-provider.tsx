"use client";

import { createContext, useContext, useCallback, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface Session {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } | null;
  impersonatedBy?: string | null;
}

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  refetchSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  refetchSession: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    data: session,
    isLoading,
    refetch,
  } = useQuery<Session>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/get-session");
      if (!res.ok) return { user: null };
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Revalide la session auprès du serveur et met le cache à jour. Nécessaire
  // quand la session a pu être révoquée côté serveur (désactivation,
  // changement de rôle) : le cache ci-dessus resterait périmé 5 minutes.
  const refetchSession = useCallback(async () => {
    const result = await refetch();
    return result.data ?? null;
  }, [refetch]);

  return (
    <AuthContext.Provider
      value={{ session: session ?? null, isLoading, refetchSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const context = useContext(AuthContext);
  return {
    data: context.session,
    isPending: context.isLoading,
    refetch: context.refetchSession,
  };
}
