"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CircleAlertIcon, MailIcon, XIcon, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { SiteHeader } from "@/components/site-header";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { invitationApi } from "@/lib/invitations";
import type { InvitationPreview } from "@/types/invitation";

type LoadState = "loading" | "ready" | "error";

/** Public landing page for the emailed invite link — works before sign-in. */
export function InvitationLanding({ token }: { token: string }) {
  const router = useRouter();
  const { status: authStatus, user, logout } = useAuth();

  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let alive = true;
    invitationApi
      .getByToken(token)
      .then((inv) => {
        if (alive) {
          setInvitation(inv);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (alive) setLoadState("error");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const accept = async () => {
    if (!invitation || busy) return;
    setBusy("accept");
    try {
      const { workspaceId } = await invitationApi.accept(invitation._id);
      toast.success(`Joined ${invitation.workspaceName}.`);
      router.push(`/dashboard/workspaces/${workspaceId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't accept that invitation.");
      setBusy(null);
    }
  };

  const decline = async () => {
    if (!invitation || busy) return;
    setBusy("decline");
    try {
      await invitationApi.decline(invitation._id);
      setDeclined(true);
      toast.success("Invitation declined.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't decline that invitation.");
    } finally {
      setBusy(null);
    }
  };

  const nextParam = encodeURIComponent(`/invitations/${token}`);
  const inviterName = invitation
    ? invitation.invitedBy.displayName || invitation.invitedBy.email || "Someone"
    : "";

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {loadState === "loading" ? (
            <Centered>
              <Spinner className="size-5" />
              Loading invitation…
            </Centered>
          ) : loadState === "error" || !invitation ? (
            <InviteCard icon={CircleAlertIcon} tone="destructive" title="Invitation not found">
              <p className="text-sm text-muted-foreground text-pretty">
                This link is invalid or has expired.
              </p>
              <LinkButton href="/" className="mt-2 h-10 w-full">
                Go home
              </LinkButton>
            </InviteCard>
          ) : declined ? (
            <InviteCard icon={XIcon} title="Invitation declined">
              <p className="text-sm text-muted-foreground text-pretty">
                You declined the invite to {invitation.workspaceName}.
              </p>
              <LinkButton href="/dashboard" className="mt-2 h-10 w-full">
                Go to dashboard
              </LinkButton>
            </InviteCard>
          ) : invitation.status !== "pending" ? (
            <InviteCard icon={MailIcon} title="Already handled">
              <p className="text-sm text-muted-foreground text-pretty">
                This invitation was already {invitation.status}.
              </p>
              <LinkButton href="/dashboard" className="mt-2 h-10 w-full">
                Go to dashboard
              </LinkButton>
            </InviteCard>
          ) : authStatus === "loading" ? (
            <Centered>
              <Spinner className="size-5" />
            </Centered>
          ) : authStatus !== "authenticated" || !user ? (
            <InviteCard icon={MailIcon} title={`Join ${invitation.workspaceName}`}>
              <p className="text-sm text-muted-foreground text-pretty">
                {inviterName} invited <span className="font-medium text-foreground">{invitation.email}</span>{" "}
                to join this workspace on Signarion.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <LinkButton href={`/auth/register?next=${nextParam}`} className="h-10 flex-1">
                  Create account
                </LinkButton>
                <LinkButton
                  href={`/auth/login?next=${nextParam}`}
                  variant="outline"
                  className="h-10 flex-1"
                >
                  Sign in
                </LinkButton>
              </div>
            </InviteCard>
          ) : user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
            <InviteCard icon={CircleAlertIcon} tone="destructive" title="Wrong account">
              <p className="text-sm text-muted-foreground text-pretty">
                This invitation was sent to{" "}
                <span className="font-medium text-foreground">{invitation.email}</span>, but you&apos;re
                signed in as <span className="font-medium text-foreground">{user.email}</span>.
              </p>
              <Button type="button" variant="outline" onClick={logout} className="mt-2 h-10 w-full">
                Sign out and try again
              </Button>
            </InviteCard>
          ) : (
            <InviteCard icon={MailIcon} title={`Join ${invitation.workspaceName}`}>
              <p className="text-sm text-muted-foreground text-pretty">
                {inviterName} invited you to join this workspace on Signarion.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={decline}
                  disabled={busy !== null}
                  className="h-10 flex-1"
                >
                  {busy === "decline" ? <Spinner /> : <XIcon />}
                  Decline
                </Button>
                <Button type="button" onClick={accept} disabled={busy !== null} className="h-10 flex-1">
                  {busy === "accept" ? <Spinner /> : <CheckIcon />}
                  Accept
                </Button>
              </div>
            </InviteCard>
          )}
        </div>
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function InviteCard({
  icon: Icon,
  title,
  tone = "default",
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone?: "default" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/10 sm:p-8">
      <span
        className={cn(
          "mx-auto grid size-12 place-items-center rounded-xl",
          tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-5" />
      </span>
      <h1 className="font-heading text-lg font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
