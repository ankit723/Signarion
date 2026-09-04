import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFallback } from "@/components/auth-fallback";
import { LoginForm } from "@/components/login-form";
import { RequireGuest } from "@/components/guards";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <RequireGuest>
        <LoginForm />
      </RequireGuest>
    </Suspense>
  );
}
