/**
 * Minimal Firebase Auth access over REST (no `firebase` SDK).
 *
 * The client only needs to: exchange email+password for an ID token (the backend
 * `POST /api/auth/login` requires one), refresh that token, and apply the
 * `oobCode` from verification / password-reset emails. All that needs is the
 * public Web API key in NEXT_PUBLIC_FIREBASE_API_KEY.
 */
import axios from "axios";

const KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
const IDENTITY = "https://identitytoolkit.googleapis.com/v1";
const SECURE_TOKEN = "https://securetoken.googleapis.com/v1";

const http = axios.create({ timeout: 20_000 });

const MESSAGES: Record<string, string> = {
  EMAIL_NOT_FOUND: "We couldn't find an account with that email.",
  INVALID_PASSWORD: "That email and password don't match.",
  INVALID_LOGIN_CREDENTIALS: "That email and password don't match.",
  INVALID_EMAIL: "That email address doesn't look right.",
  USER_DISABLED: "This account has been disabled.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Try again in a few minutes.",
  EMAIL_EXISTS: "An account with this email already exists.",
  WEAK_PASSWORD: "Please choose a stronger password (at least 6 characters).",
  INVALID_OOB_CODE: "This link is invalid or has already been used.",
  EXPIRED_OOB_CODE: "This link has expired — request a new one.",
};

function toError(err: unknown): Error {
  if (axios.isAxiosError(err)) {
    if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") {
      return new Error("Can't reach the authentication service.");
    }
    const raw =
      (err.response?.data as { error?: { message?: string } } | undefined)?.error
        ?.message ?? "";
    const token = raw.split(":")[0].trim();
    return new Error(MESSAGES[token] ?? "Authentication failed. Please try again.");
  }
  return err instanceof Error ? err : new Error("Something went wrong.");
}

export interface Tokens {
  idToken: string;
  refreshToken: string;
}

function ensureKey() {
  if (!KEY) {
    throw new Error(
      "Firebase Web API key is missing. Set NEXT_PUBLIC_FIREBASE_API_KEY in client/.env.local."
    );
  }
}

export async function signIn(email: string, password: string): Promise<Tokens> {
  ensureKey();
  try {
    const { data } = await http.post(
      `${IDENTITY}/accounts:signInWithPassword`,
      { email, password, returnSecureToken: true },
      { params: { key: KEY } }
    );
    return { idToken: data.idToken, refreshToken: data.refreshToken };
  } catch (err) {
    throw toError(err);
  }
}

export async function refreshTokens(refreshToken: string): Promise<Tokens> {
  ensureKey();
  const { data } = await http.post(
    `${SECURE_TOKEN}/token`,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    { params: { key: KEY } }
  );
  return { idToken: data.id_token, refreshToken: data.refresh_token };
}

/** Completes `?mode=verifyEmail`. */
export async function applyVerificationCode(oobCode: string): Promise<void> {
  ensureKey();
  try {
    await http.post(`${IDENTITY}/accounts:update`, { oobCode }, { params: { key: KEY } });
  } catch (err) {
    throw toError(err);
  }
}

/** Validates a `?mode=resetPassword` code (without consuming it); returns the email. */
export async function checkResetCode(oobCode: string): Promise<string | undefined> {
  ensureKey();
  try {
    const { data } = await http.post(
      `${IDENTITY}/accounts:resetPassword`,
      { oobCode },
      { params: { key: KEY } }
    );
    return data.email as string | undefined;
  } catch (err) {
    throw toError(err);
  }
}

export async function confirmReset(oobCode: string, newPassword: string): Promise<void> {
  ensureKey();
  try {
    await http.post(
      `${IDENTITY}/accounts:resetPassword`,
      { oobCode, newPassword },
      { params: { key: KEY } }
    );
  } catch (err) {
    throw toError(err);
  }
}
