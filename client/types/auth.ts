export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  metadata?: { creationTime?: string; lastSignInTime?: string };
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
