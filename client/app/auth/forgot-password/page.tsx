import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFallback } from "@/components/auth-fallback";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { RequireGuest } from "@/components/guards";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <RequireGuest>
        <ForgotPasswordForm />
      </RequireGuest>
    </Suspense>
  );
}
