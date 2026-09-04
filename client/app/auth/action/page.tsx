import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFallback } from "@/components/auth-fallback";
import { EmailAction } from "@/components/email-action";

export const metadata: Metadata = { title: "Account action" };

export default function ActionPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <EmailAction />
    </Suspense>
  );
}
