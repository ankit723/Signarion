"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon, LockIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { useForm } from "@/hooks/use-form";
import { ROUTES, afterAuthPath } from "@/lib/auth";
import { checkEmail, checkPassword } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const next = params.get("next");

  const notice = params.get("registered")
    ? "Account created. Sign in to continue."
    : params.get("expired")
      ? "Your session expired. Please sign in again."
      : params.get("reset")
        ? "Password updated. Sign in with your new password."
        : null;

  const form = useForm({
    initial: { email: "", password: "" },
    validate: (v) => ({ email: checkEmail(v.email), password: checkPassword(v.password) }),
    onSubmit: async (v) => {
      const user = await login(v.email, v.password);
      toast.success("Welcome back.");
      router.replace(afterAuthPath(user, next));
    },
  });

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Account access
      </p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Welcome back — enter your details to continue.
      </p>

      <form noValidate onSubmit={form.handleSubmit} className="mt-7 space-y-4">
        {notice ? <FormAlert tone="info">{notice}</FormAlert> : null}
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}

        <Field
          label="Email"
          type="email"
          icon={MailIcon}
          autoComplete="email"
          placeholder="you@company.com"
          autoFocus
          disabled={form.submitting}
          error={form.errors.email}
          {...form.field("email")}
        />

        <Field
          label="Password"
          type="password"
          icon={LockIcon}
          autoComplete="current-password"
          placeholder="Your password"
          disabled={form.submitting}
          error={form.errors.password}
          action={
            <Link
              href={ROUTES.forgotPassword}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          }
          {...form.field("password")}
        />

        <Button type="submit" size="lg" disabled={form.submitting} className="h-11 w-full">
          {form.submitting ? <Spinner /> : null}
          Sign in
          {form.submitting ? null : <ArrowRightIcon />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={next ? `${ROUTES.register}?next=${encodeURIComponent(next)}` : ROUTES.register}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
