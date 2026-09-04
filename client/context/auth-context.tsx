"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import type { AuthStatus, AuthUser } from "@/types/auth";
import { ROUTES, authApi } from "@/lib/auth";
import { syncTokens } from "@/lib/tokens";

interface AuthValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<{ user: AuthUser | null }>;
  logout: () => void;
  /** Re-fetch the user from `GET /api/auth/me`. */
  refreshUser: () => Promise<void>;
  /** Force a fresh token + session (use after email verification). */
  resync: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const apply = useCallback((next: AuthUser | null) => {
    setUser(next);
    setStatus(next ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const hasTokens = Boolean(syncTokens());
      try {
        const current = hasTokens ? await authApi.currentUser() : null;
        if (alive) apply(current);
      } catch {
        authApi.logout();
        if (alive) apply(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [apply]);

  const login = useCallback(
    async (email: string, password: string) => {
      const current = await authApi.login(email, password);
      apply(current);
      return current;
    },
    [apply]
  );

  const register = useCallback(
    async (displayName: string, email: string, password: string) => {
      const result = await authApi.register(displayName, email, password);
      if (result.user) apply(result.user);
      return result;
    },
    [apply]
  );

  const logout = useCallback(() => {
    authApi.logout();
    apply(null);
    router.replace(ROUTES.login);
  }, [apply, router]);

  const refreshUser = useCallback(async () => {
    try {
      apply(await authApi.currentUser());
    } catch {
      authApi.logout();
      apply(null);
    }
  }, [apply]);

  const resync = useCallback(async () => {
    const current = await authApi.resync();
    if (current) apply(current);
  }, [apply]);

  const value = useMemo<AuthValue>(
    () => ({ user, status, login, register, logout, refreshUser, resync }),
    [user, status, login, register, logout, refreshUser, resync]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within <AuthProvider>.");
  return value;
}
