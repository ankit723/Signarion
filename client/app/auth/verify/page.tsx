import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFallback } from "@/components/auth-fallback";
import { VerifyNotice } from "@/components/verify-notice";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <VerifyNotice />
    </Suspense>
  );
}
