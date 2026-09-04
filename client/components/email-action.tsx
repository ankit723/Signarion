"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleCheckIcon } from "lucide-react";

import { FormAlert } from "@/components/form-alert";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { ROUTES, authApi } from "@/lib/auth";

type Phase = "verifying" | "success" | "error";

function VerifyEmailAction({ oobCode }: { oobCode: string | null }) {
  const router = useRouter();
  const { status, resync } = useAuth();
  const [phase, setPhase] = useState<Phase>(oobCode ? "verifying" : "error");
  const [message, setMessage] = useState(
    oobCode ? "" : "This verification link is missing its security code."
  );
  const ran = useRef(false);

  useEffect(() => {
    // Guard against a second call — the oobCode is single-use. We intentionally
    // don't gate the result on an "active" flag (its cleanup would swallow the
    // one real result under StrictMode's double-invoke).
    if (!oobCode || ran.current) return;
    ran.current = true;

    authApi
      .verifyEmail(oobCode)
      .then(async () => {
        setPhase("success");
        if (status === "authenticated") await resync();
      })
      .catch((err: unknown) => {
        setPhase("error");
        setMessage(err instanceof Error ? err.message : "We couldn't verify that link.");
      });
  }, [oobCode, status, resync]);

  useEffect(() => {
    if (phase !== "success") return;
    const authed = status === "authenticated";
    const t = setTimeout(
      () => router.replace(authed ? ROUTES.dashboard : ROUTES.login),
      1600
    );
    return () => clearTimeout(t);
  }, [phase, status, router]);

  if (phase === "verifying") {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Confirming your verification link…
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Email verification
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">You&apos;re verified</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Redirecting you now…</p>
        <div className="mt-7 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <CircleCheckIcon className="size-5" />
        </div>
        <LinkButton
          href={status === "authenticated" ? ROUTES.dashboard : ROUTES.login}
          className="mt-4 h-11 w-full"
        >
          Continue
        </LinkButton>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Email verification
      </p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
        We couldn&apos;t verify that link
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Links can only be used once and expire after a while.
      </p>
      <div className="mt-7 space-y-4">
        <FormAlert>{message}</FormAlert>
        <LinkButton href={ROUTES.verify} className="h-11 w-full">
          Get a new link
        </LinkButton>
      </div>
    </div>
  );
}

/** Entry for `/auth/action` — dispatches on Firebase's `mode` param. */
export function EmailAction() {
  const params = useSearchParams();
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  if (mode === "resetPassword") return <ResetPasswordForm oobCode={oobCode} />;
  if (mode === "verifyEmail") return <VerifyEmailAction oobCode={oobCode} />;

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Account action
      </p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Unsupported link</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        This action link isn&apos;t one we recognise.
      </p>
      <div className="mt-7">
        <LinkButton href={ROUTES.login} className="h-11 w-full">
          Back to sign in
        </LinkButton>
      </div>
    </div>
  );
}
