/**
 * Axios instance for the Express API. Attaches the Firebase ID token as a Bearer
 * header and, on a 401, refreshes the token once and retries. If the refresh
 * fails the tokens are cleared and the user is sent to the login page.
 */
import axios, { AxiosError } from "axios";

import { getTokens, setTokens, clearTokens } from "@/lib/tokens";
import { refreshTokens } from "@/lib/firebase";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001/api",
});

api.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens) config.headers.set("Authorization", `Bearer ${tokens.idToken}`);
  return config;
});

let refreshing: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    const tokens = getTokens();
    refreshing = (
      tokens?.refreshToken
        ? refreshTokens(tokens.refreshToken)
        : Promise.reject(new Error("no refresh token"))
    )
      .then((next) => {
        setTokens(next);
        return next.idToken;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && config && !config._retry && getTokens()) {
      config._retry = true;
      const idToken = await refreshOnce();
      if (idToken) {
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>).Authorization = `Bearer ${idToken}`;
        return api(config);
      }
      if (typeof window !== "undefined") {
        // Refresh token is dead. A full document load is intentional here — it
        // re-bootstraps auth from scratch — and this runs outside React, so
        // there's no router to use.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/auth/login?expired=1");
      }
    }

    return Promise.reject(error);
  }
);

/** Turns any thrown API value into a display string. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") {
      return "Can't reach the server. Make sure the API is running.";
    }
    const status = err.response?.status;
    const message = (err.response?.data as { error?: string } | undefined)?.error;
    if (status === 429) return "Too many requests. Please try again shortly.";
    if (status && status >= 500) return "The server ran into a problem. Try again shortly.";
    if (message) return message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

export default api;
