"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon, LockIcon, MailIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { useForm } from "@/hooks/use-form";
import { ROUTES, afterAuthPath } from "@/lib/auth";
import { checkConfirm, checkEmail, checkName, checkNewPassword } from "@/lib/validation";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { register } = useAuth();
  const next = params.get("next");

  const form = useForm({
    initial: { name: "", email: "", password: "", confirm: "" },
    validate: (v) => ({
      name: checkName(v.name),
      email: checkEmail(v.email),
      password: checkNewPassword(v.password),
      confirm: checkConfirm(v.password, v.confirm),
    }),
    onSubmit: async (v) => {
      const { user } = await register(v.name, v.email, v.password);
      if (user) {
        toast.success("Account created. Check your inbox to verify your email.");
        router.replace(afterAuthPath(user, next));
      } else {
        toast.success("Account created. Sign in to continue.");
        router.replace(`${ROUTES.login}?registered=1`);
      }
    },
  });

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Get started
      </p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Start turning buying signals into conversations.
      </p>

      <form noValidate onSubmit={form.handleSubmit} className="mt-7 space-y-4">
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}

        <Field
          label="Full name"
          icon={UserIcon}
          autoComplete="name"
          placeholder="Ada Lovelace"
          autoFocus
          disabled={form.submitting}
          error={form.errors.name}
          {...form.field("name")}
        />
        <Field
          label="Email"
          type="email"
          icon={MailIcon}
          autoComplete="email"
          placeholder="you@company.com"
          disabled={form.submitting}
          error={form.errors.email}
          {...form.field("email")}
        />
        <Field
          label="Password"
          type="password"
          icon={LockIcon}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          disabled={form.submitting}
          error={form.errors.password}
          {...form.field("password")}
        />
        <Field
          label="Confirm password"
          type="password"
          icon={LockIcon}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          disabled={form.submitting}
          error={form.errors.confirm}
          {...form.field("confirm")}
        />

        <Button type="submit" size="lg" disabled={form.submitting} className="h-11 w-full">
          {form.submitting ? <Spinner /> : null}
          Create account
          {form.submitting ? null : <ArrowRightIcon />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={next ? `${ROUTES.login}?next=${encodeURIComponent(next)}` : ROUTES.login}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
