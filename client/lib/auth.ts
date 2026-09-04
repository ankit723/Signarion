/**
 * Everything the UI needs for auth. Talks to the Express API
 * (server/src/routes/auth.routes.js) and Firebase REST via `@/lib/firebase`.
 */
import axios from "axios";

import type { AuthUser } from "@/types/auth";
import api, { apiError } from "@/lib/api";
import { clearTokens, getTokens, setTokens } from "@/lib/tokens";
import {
  applyVerificationCode,
  checkResetCode,
  confirmReset,
  refreshTokens,
  signIn,
} from "@/lib/firebase";

export const ROUTES = {
  home: "/",
  login: "/auth/login",
  register: "/auth/register",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  verify: "/auth/verify",
  action: "/auth/action",
  dashboard: "/dashboard",
} as const;

/** Shared by the login form and the guest guard so their redirects never race. */
export function afterAuthPath(
  user: Pick<AuthUser, "emailVerified">,
  next?: string | null
): string {
  if (!user.emailVerified) return ROUTES.verify;
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return ROUTES.dashboard;
}

/** Firebase sign-in -> backend session -> the authenticated user. */
async function openSession(email: string, password: string): Promise<AuthUser> {
  setTokens(await signIn(email, password));
  try {
    const { data } = await api.post<{ user: AuthUser }>("/auth/login");
    return data.user;
  } catch (err) {
    clearTokens();
    throw new Error(apiError(err));
  }
}

export const authApi = {
  login(email: string, password: string): Promise<AuthUser> {
    return openSession(email.trim(), password);
  },

  async register(
    displayName: string,
    email: string,
    password: string
  ): Promise<{ user: AuthUser | null }> {
    try {
      await api.post("/auth/register", {
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
    } catch (err) {
      throw new Error(apiError(err));
    }
    // Sign in straight away so the verify screen has a session for "resend".
    try {
      return { user: await openSession(email.trim(), password) };
    } catch {
      clearTokens();
      return { user: null };
    }
  },

  async currentUser(): Promise<AuthUser> {
    try {
      const { data } = await api.get<{ user: AuthUser }>("/auth/me");
      return data.user;
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  logout(): void {
    clearTokens();
  },

  async resendVerification(): Promise<string> {
    try {
      const { data } = await api.get<{ message: string }>("/auth/verify");
      return data.message;
    } catch (err) {
      if (axiosStatus(err) === 400) throw new Error("ALREADY_VERIFIED");
      throw new Error(apiError(err));
    }
  },

  async forgotPassword(email: string): Promise<string> {
    try {
      const { data } = await api.post<{ message: string }>("/auth/forgot-password", {
        email: email.trim(),
      });
      return data.message;
    } catch (err) {
      throw new Error(apiError(err));
    }
  },

  verifyEmail: applyVerificationCode,
  checkResetCode,
  confirmReset,

  /**
   * After the email is verified out-of-band, `GET /api/auth/me` still serves a
   * stale Redis snapshot. Forcing a token refresh (now `email_verified: true`)
   * and re-running `/auth/login` rewrites that snapshot.
   */
  async resync(): Promise<AuthUser | null> {
    const tokens = getTokens();
    if (!tokens) return null;
    try {
      setTokens(await refreshTokens(tokens.refreshToken));
      const { data } = await api.post<{ user: AuthUser }>("/auth/login");
      return data.user;
    } catch {
      return null;
    }
  },
};

function axiosStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}
