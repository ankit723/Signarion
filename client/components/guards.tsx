"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { ROUTES, afterAuthPath } from "@/lib/auth";

function Gate({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[50svh] items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner className="size-5" />
      {label}
    </div>
  );
}

/** Authenticated-only areas: waits for status, then redirects guests to login. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      const target = pathname && pathname !== ROUTES.login ? pathname : ROUTES.dashboard;
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(target)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") return <Gate label="Checking your session…" />;
  return <>{children}</>;
}

/** Signed-out-only pages (login, register, …): bounces signed-in users away. */
export function RequireGuest({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(afterAuthPath(user, searchParams.get("next")));
    }
  }, [status, user, router, searchParams]);

  if (status !== "unauthenticated") return <Gate label="Loading…" />;
  return <>{children}</>;
}
