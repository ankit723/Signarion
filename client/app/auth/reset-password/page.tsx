import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFallback } from "@/components/auth-fallback";
import { ResetPasswordEntry } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <ResetPasswordEntry />
    </Suspense>
  );
}
