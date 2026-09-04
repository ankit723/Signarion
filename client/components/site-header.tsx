"use client";

import Link from "next/link";
import { InboxIcon, LogOutIcon, SettingsIcon } from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/auth";

/** App header. `variant="app"` drops the "Dashboard" link (you're already there). */
export function SiteHeader({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const { status, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Brand />

        <div className="flex items-center gap-1 sm:gap-2">
          {status === "loading" ? (
            <Spinner className="size-4 text-muted-foreground" />
          ) : status === "authenticated" && user ? (
            <>
              {variant === "marketing" ? (
                <LinkButton href={ROUTES.dashboard} size="sm" variant="outline">
                  Dashboard
                </LinkButton>
              ) : (
                <>
                  <LinkButton href="/account" size="sm" variant="ghost">
                    <SettingsIcon className="size-4" />
                    <span className="hidden sm:inline">Account</span>
                  </LinkButton>
                </>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={logout}>
                <LogOutIcon className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Link
                href={ROUTES.login}
                className="hidden px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
              >
                Sign in
              </Link>
              <LinkButton href={ROUTES.register} size="sm">
                Get started
              </LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
