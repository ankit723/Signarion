"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheckIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { ROUTES, authApi } from "@/lib/auth";

const COOLDOWN = 45;

export function VerifyNotice() {
  const router = useRouter();
  const { user, status, resync } = useAuth();
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState<"resend" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verified = Boolean(user?.emailVerified);
  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => router.replace(ROUTES.dashboard), 1200);
    return () => clearTimeout(t);
  }, [verified, router]);

  const resend = useCallback(async () => {
    setBusy("resend");
    setError(null);
    try {
      const message = await authApi.resendVerification();
      toast.success(message || "Verification email sent.");
      setCooldown(COOLDOWN);
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_VERIFIED") {
        toast.success("Your email is already verified.");
        await resync();
        router.replace(ROUTES.dashboard);
        return;
      }
      setError(err instanceof Error ? err.message : "Couldn't send the email.");
    } finally {
      setBusy(null);
    }
  }, [resync, router]);

  const check = useCallback(async () => {
    setBusy("check");
    setError(null);
    try {
      await resync();
    } finally {
      setBusy(null);
    }
  }, [resync]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Checking your status…
      </div>
    );
  }

  if (verified) {
    return (
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Email verification
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Email verified</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Taking you to your dashboard…</p>
        <div className="mt-7 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <MailCheckIcon className="size-5" />
        </div>
        <LinkButton href={ROUTES.dashboard} className="mt-4 h-11 w-full">
          Go to dashboard
        </LinkButton>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Email verification
      </p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Verify your email</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {user?.email ? (
          <>
            We sent a link to <span className="font-medium text-foreground">{user.email}</span>. Open
            it to activate your account.
          </>
        ) : (
          "We sent you a verification link. Open it, then sign in."
        )}
      </p>

      <div className="mt-7 space-y-4">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Check your spam or promotions folder.</li>
          <li>• Links expire after a while — resend if it&apos;s stale.</li>
        </ul>

        {user ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Button
              type="button"
              onClick={resend}
              disabled={busy !== null || cooldown > 0}
              className="h-11"
            >
              {busy === "resend" ? <Spinner /> : null}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={check}
              disabled={busy !== null}
              className="h-11"
            >
              {busy === "check" ? <Spinner /> : <RefreshCwIcon className="size-4" />}
              I&apos;ve verified
            </Button>
          </div>
        ) : (
          <LinkButton href={ROUTES.login} className="h-11 w-full">
            Continue to sign in
          </LinkButton>
        )}
      </div>
    </div>
  );
}
