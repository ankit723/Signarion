"use client";

import { useState } from "react";
import { InboxIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { FormAlert } from "@/components/form-alert";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { useAuth } from "@/context/auth-context";
import { useForm } from "@/hooks/use-form";
import { authApi } from "@/lib/auth";
import { checkConfirm, checkEmail, checkName, checkNewPassword } from "@/lib/validation";
import type { AuthUser } from "@/types/auth";
import { LinkButton } from "../ui/link-button";

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AccountSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!user) return null;

  // Changing email or password revokes the session server-side — sign out and
  // send the user back to login rather than let stray requests 401 mid-page.
  const onCredentialsChanged = () => {
    toast.message("Please sign in again to continue.");
    logout();
  };

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="w-full flex justify-between items-center">
          <div className="">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight">
              Account settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your profile and password.
            </p>
          </div>
          <LinkButton href="/account/invitations" size="sm" variant="ghost">
            <InboxIcon className="size-4" />
            <span className="hidden sm:inline">Invitations</span>
          </LinkButton>
        </div>
      </Reveal>

      <Reveal delay={40}>
        <ProfileForm
          user={user}
          onProfileSaved={() => void refreshUser()}
          onCredentialsChanged={onCredentialsChanged}
        />
      </Reveal>

      <Reveal delay={80}>
        <PasswordForm onSaved={onCredentialsChanged} />
      </Reveal>

      <Reveal delay={120}>
        <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="font-heading text-sm font-semibold tracking-tight">Account info</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {(
              [
                ["Verification", user.emailVerified ? "Verified" : "Not verified"],
                ["Created", formatDate(user.metadata?.creationTime)],
                ["Last sign-in", formatDate(user.metadata?.lastSignInTime)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <Reveal delay={160}>
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-destructive">
            Danger zone
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete your account. This can&apos;t be undone.
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="mt-4"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
            Delete account
          </Button>
        </section>
      </Reveal>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} user={user} />
    </div>
  );
}

function ProfileForm({
  user,
  onProfileSaved,
  onCredentialsChanged,
}: {
  user: AuthUser;
  onProfileSaved: () => void;
  onCredentialsChanged: () => void;
}) {
  const form = useForm({
    initial: { name: user.displayName, email: user.email },
    validate: (v) => ({ name: checkName(v.name), email: checkEmail(v.email) }),
    onSubmit: async (v) => {
      const name = v.name.trim();
      const email = v.email.trim();
      const patch: { displayName?: string; email?: string } = {};
      if (name !== user.displayName) patch.displayName = name;
      if (email.toLowerCase() !== user.email.toLowerCase()) patch.email = email;

      if (Object.keys(patch).length === 0) {
        toast.info("Nothing to save.");
        return;
      }

      await authApi.updateAccount(patch);

      if (patch.email) {
        toast.success("Email updated.");
        onCredentialsChanged();
      } else {
        toast.success("Profile updated.");
        onProfileSaved();
      }
    },
  });

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="font-heading text-sm font-semibold tracking-tight">Profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your name and the email you sign in with.
      </p>

      <form noValidate onSubmit={form.handleSubmit} className="mt-5 space-y-4">
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}

        <Field
          label="Full name"
          autoComplete="name"
          disabled={form.submitting}
          error={form.errors.name}
          {...form.field("name")}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          disabled={form.submitting}
          error={form.errors.email}
          {...form.field("email")}
        />
        <p className="text-xs text-muted-foreground">
          Changing your email re-triggers verification and signs you out everywhere.
        </p>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.submitting} className="min-w-32">
            {form.submitting ? <Spinner /> : null}
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm({ onSaved }: { onSaved: () => void }) {
  const form = useForm({
    initial: { password: "", confirm: "" },
    validate: (v) => ({
      password: checkNewPassword(v.password),
      confirm: checkConfirm(v.password, v.confirm),
    }),
    onSubmit: async (v) => {
      await authApi.updateAccount({ password: v.password });
      toast.success("Password updated.");
      onSaved();
    },
  });

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="font-heading text-sm font-semibold tracking-tight">Password</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a new password. You&apos;ll be signed out everywhere once it&apos;s changed.
      </p>

      <form noValidate onSubmit={form.handleSubmit} className="mt-5 space-y-4">
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}

        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          disabled={form.submitting}
          error={form.errors.password}
          {...form.field("password")}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          disabled={form.submitting}
          error={form.errors.confirm}
          {...form.field("confirm")}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={form.submitting} className="min-w-32">
            {form.submitting ? <Spinner /> : null}
            Update password
          </Button>
        </div>
      </form>
    </section>
  );
}
