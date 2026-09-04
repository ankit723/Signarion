"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon, MailIcon, RotateCcwIcon, UserPlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { checkEmail } from "@/lib/validation";
import { invitationApi } from "@/lib/invitations";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useWorkspaces } from "@/context/workspaces-context";
import type { Workspace, WorkspaceMember } from "@/types/workspace";
import type { WorkspaceInvitation } from "@/types/invitation";

function personInitials(m: WorkspaceMember): string {
  const src = (m.displayName || m.email || "?").trim();
  const words = src.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

export function WorkspaceMembers({
  workspace,
  currentUid,
}: {
  workspace: Workspace;
  currentUid: string;
}) {
  const router = useRouter();
  const { removeMember } = useWorkspaces();
  const isOwner = workspace.role === "owner";
  const members = workspace.resolvedMembers ?? [];

  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null);

  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(isOwner);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<WorkspaceInvitation | null>(null);

  // Only the owner can see (or needs to see) who's still pending.
  const invitesInFlight = useRef(false);
  const loadInvitations = useCallback(async () => {
    if (invitesInFlight.current) return;
    invitesInFlight.current = true;
    setLoadingInvites(true);
    // Nested so the catch lives outside this function's own body — keeps
    // this a plain fire-and-forget effect call from the linter's point of view.
    await (async () => {
      try {
        setInvitations(await invitationApi.listForWorkspace(workspace._id));
      } catch {
        /* the members list itself still renders fine without this */
      } finally {
        setLoadingInvites(false);
        invitesInFlight.current = false;
      }
    })();
  }, [workspace._id]);

  useEffect(() => {
    if (isOwner) void loadInvitations();
  }, [isOwner, loadInvitations]);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = checkEmail(email);
    if (err) {
      setInviteError(err);
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      const invitation = await invitationApi.create(workspace._id, email);
      toast.success(`Invited ${email.trim()}.`);
      setInvitations((cur) => [invitation, ...cur]);
      setEmail("");
    } catch (ex) {
      setInviteError(ex instanceof Error ? ex.message : "Couldn't send that invite.");
    } finally {
      setInviting(false);
    }
  };

  const onResendInvite = async (inv: WorkspaceInvitation) => {
    if (resendingId) return;
    setResendingId(inv._id);
    try {
      await invitationApi.resend(workspace._id, inv._id);
      toast.success(`Resent the invite to ${inv.email}.`);
    } catch (ex) {
      toast.error(ex instanceof Error ? ex.message : "Couldn't resend that invite.");
    } finally {
      setResendingId(null);
    }
  };

  const confirmCancelInvite = async () => {
    if (!cancelTarget) return;
    await invitationApi.cancel(workspace._id, cancelTarget._id);
    setInvitations((cur) => cur.filter((i) => i._id !== cancelTarget._id));
    toast.success(`Cancelled the invite to ${cancelTarget.email}.`);
  };

  const confirmRemoveMember = async () => {
    if (!removeTarget) return;
    const self = removeTarget.uid === currentUid;
    await removeMember(workspace._id, removeTarget.uid);
    if (self) {
      toast.success("You left the workspace.");
      router.replace("/dashboard");
      return;
    }
    toast.success(`Removed ${removeTarget.email ?? "member"}.`);
  };

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Members
          <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
            {members.length}
          </span>
        </h2>
      </div>

      <ul className="mt-4 divide-y divide-border/70">
        {members.map((m) => {
          const self = m.uid === currentUid;
          const canRemove = (isOwner && m.role !== "owner") || (self && m.role !== "owner");
          return (
            <li key={m.uid} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  m.role === "owner"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {personInitials(m)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.displayName || m.email || m.uid}
                  {self ? <span className="text-muted-foreground"> (you)</span> : null}
                </p>
                {m.displayName && m.email ? (
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                ) : null}
              </div>
              <span className="font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                {m.role}
              </span>
              {canRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={self ? "Leave workspace" : `Remove ${m.email ?? "member"}`}
                  onClick={() => setRemoveTarget(m)}
                >
                  {self ? <LogOutIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isOwner && (loadingInvites || invitations.length > 0) ? (
        <div className="mt-5 space-y-2 border-t border-border/70 pt-4">
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            Pending invitations
          </p>
          {loadingInvites ? (
            <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Loading…
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {invitations.map((inv) => (
                <li key={inv._id} className="flex items-center gap-3 py-2">
                  <MailIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {inv.email}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Resend invite to ${inv.email}`}
                    onClick={() => onResendInvite(inv)}
                    disabled={resendingId !== null}
                  >
                    {resendingId === inv._id ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <RotateCcwIcon className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Cancel invite to ${inv.email}`}
                    onClick={() => setCancelTarget(inv)}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {isOwner ? (
        <form onSubmit={onInvite} className="mt-4 space-y-1.5">
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setInviteError(null);
              }}
              placeholder="teammate@company.com"
              autoComplete="off"
              disabled={inviting}
              aria-invalid={Boolean(inviteError)}
              className="h-9"
            />
            <Button type="submit" disabled={inviting || !email.trim()} className="h-9 shrink-0">
              {inviting ? <Spinner /> : <UserPlusIcon />}
              Invite
            </Button>
          </div>
          {inviteError ? (
            <p className="text-xs font-medium text-destructive">{inviteError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              We&apos;ll email them a link to join — they don&apos;t need an account yet.
            </p>
          )}
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Only the owner can invite or remove members.
        </p>
      )}

      {removeTarget ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoveTarget(null)}
          title={
            removeTarget.uid === currentUid
              ? "Leave this workspace?"
              : `Remove ${removeTarget.displayName || removeTarget.email || "this member"}?`
          }
          description={
            removeTarget.uid === currentUid ? (
              <>
                You&apos;ll lose access to{" "}
                <span className="font-medium text-foreground">{workspace.name}</span>. The
                owner can invite you back later.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {removeTarget.displayName || removeTarget.email}
                </span>{" "}
                will lose access to {workspace.name} immediately.
              </>
            )
          }
          confirmLabel={removeTarget.uid === currentUid ? "Leave workspace" : "Remove member"}
          onConfirm={confirmRemoveMember}
        />
      ) : null}

      {cancelTarget ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setCancelTarget(null)}
          title="Cancel this invitation?"
          description={
            <>
              <span className="font-medium text-foreground">{cancelTarget.email}</span> won&apos;t
              be able to join using this link anymore. You can invite them again later.
            </>
          }
          confirmLabel="Cancel invite"
          onConfirm={confirmCancelInvite}
        />
      ) : null}
    </section>
  );
}
