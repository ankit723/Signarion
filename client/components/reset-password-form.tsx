"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleCheckIcon, LockIcon } from "lucide-react";

import { Field } from "@/components/field";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { useForm } from "@/hooks/use-form";
import { ROUTES, authApi } from "@/lib/auth";
import { clearTokens } from "@/lib/tokens";
import { checkConfirm, checkNewPassword } from "@/lib/validation";

type Check = "checking" | "valid" | "invalid";

/** Route entry for `/auth/reset-password?oobCode=…`. */
export function ResetPasswordEntry() {
  const oobCode = useSearchParams().get("oobCode");
  return <ResetPasswordForm oobCode={oobCode} />;
}

export function ResetPasswordForm({ oobCode }: { oobCode: string | null }) {
  const router = useRouter();
  const [check, setCheck] = useState<Check>(oobCode ? "checking" : "invalid");
  const [checkError, setCheckError] = useState<string | null>(
    oobCode ? null : "This reset link is missing its security code."
  );
  const [email, setEmail] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!oobCode) return;
    let alive = true;
    authApi
      .checkResetCode(oobCode)
      .then((addr) => {
        if (!alive) return;
        setEmail(addr);
        setCheck("valid");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setCheckError(err instanceof Error ? err.message : "This link is invalid or expired.");
        setCheck("invalid");
      });
    return () => {
      alive = false;
    };
  }, [oobCode]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const form = useForm({
    initial: { password: "", confirm: "" },
    validate: (v) => ({
      password: checkNewPassword(v.password),
      confirm: checkConfirm(v.password, v.confirm),
    }),
    onSubmit: async (v) => {
      if (!oobCode) return;
      await authApi.confirmReset(oobCode, v.password);
      clearTokens();
      setDone(true);
      timer.current = setTimeout(() => router.replace(`${ROUTES.login}?reset=1`), 1600);
    },
  });

  if (check === "checking") {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Checking your reset link…
      </div>
    );
  }

  if (check === "invalid") {
    return (
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Password help
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
          This link doesn&apos;t work
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Reset links expire quickly and can only be used once.
        </p>
        <div className="mt-7 space-y-4">
          <FormAlert>{checkError}</FormAlert>
          <LinkButton href={ROUTES.forgotPassword} className="h-11 w-full">
            Request a new link
          </LinkButton>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Password help
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Password updated</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Redirecting you to sign in…</p>
        <div className="mt-7 space-y-4">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <CircleCheckIcon className="size-5" />
          </div>
          <LinkButton href={`${ROUTES.login}?reset=1`} className="h-11 w-full">
            Continue to sign in
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Password help
      </p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
        Choose a new password
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {email ? (
          <>
            For <span className="font-medium text-foreground">{email}</span>.
          </>
        ) : (
          "Pick something you haven't used before."
        )}
      </p>

      <form noValidate onSubmit={form.handleSubmit} className="mt-7 space-y-4">
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}

        <Field
          label="New password"
          type="password"
          icon={LockIcon}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          autoFocus
          disabled={form.submitting}
          error={form.errors.password}
          {...form.field("password")}
        />
        <Field
          label="Confirm new password"
          type="password"
          icon={LockIcon}
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          disabled={form.submitting}
          error={form.errors.confirm}
          {...form.field("confirm")}
        />

        <Button type="submit" size="lg" disabled={form.submitting} className="h-11 w-full">
          {form.submitting ? <Spinner /> : null}
          Update password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href={ROUTES.login} className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
