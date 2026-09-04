import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFallback } from "@/components/auth-fallback";
import { RegisterForm } from "@/components/register-form";
import { RequireGuest } from "@/components/guards";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <RequireGuest>
        <RegisterForm />
      </RequireGuest>
    </Suspense>
  );
}
