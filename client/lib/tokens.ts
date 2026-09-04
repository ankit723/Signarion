/** Firebase token persistence: localStorage + an in-memory cache. Kept in its
 * own file so `api.ts` and `auth.ts` can both use it without a circular import. */
import type { Tokens } from "@/lib/firebase";

const STORAGE_KEY = "sbo.tokens";
const canUseStorage = typeof window !== "undefined";

function read(): Tokens | null {
  if (!canUseStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Tokens>) : null;
    return parsed?.idToken && parsed?.refreshToken
      ? { idToken: parsed.idToken, refreshToken: parsed.refreshToken }
      : null;
  } catch {
    return null;
  }
}

let cache: Tokens | null = read();

export const getTokens = (): Tokens | null => cache;

export function setTokens(tokens: Tokens): void {
  cache = tokens;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    /* storage unavailable — in-memory cache still serves this tab */
  }
}

export function clearTokens(): void {
  cache = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Re-reads from storage (used once on app start). */
export const syncTokens = (): Tokens | null => (cache = read());
