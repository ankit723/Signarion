"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, MailCheckIcon, MailIcon } from "lucide-react";

import { Field } from "@/components/field";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useForm } from "@/hooks/use-form";
import { ROUTES, authApi } from "@/lib/auth";
import { checkEmail } from "@/lib/validation";

const BackToLogin = () => (
  <Link
    href={ROUTES.login}
    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
  >
    <ArrowLeftIcon className="size-3.5" />
    Back to sign in
  </Link>
);

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm({
    initial: { email: "" },
    validate: (v) => ({ email: checkEmail(v.email) }),
    onSubmit: async (v) => {
      await authApi.forgotPassword(v.email);
      setSentTo(v.email.trim());
    },
  });

  if (sentTo) {
    return (
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Password help
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{sentTo}</span>,
          a password reset link is on its way.
        </p>

        <div className="mt-7 space-y-4">
          <FormAlert tone="success">
            The link expires after a short while — request another below if you need it.
          </FormAlert>
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <MailCheckIcon className="size-5" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => setSentTo(null)}
          >
            Use a different email
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <BackToLogin />
          </p>
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
        Forgot your password?
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter your account email and we&apos;ll send a reset link.
      </p>

      <form noValidate onSubmit={form.handleSubmit} className="mt-7 space-y-4">
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

        <Button type="submit" size="lg" disabled={form.submitting} className="h-11 w-full">
          {form.submitting ? <Spinner /> : null}
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <BackToLogin />
      </p>
    </div>
  );
}
