"use client";

import { useState } from "react";
import { TriangleAlertIcon, Trash2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogEyebrow,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authApi } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";

const CONFIRM_WORD = "DELETE";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser;
}

export function DeleteAccountDialog({ open, onOpenChange, user }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <Body user={user} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}

function Body({ user, onOpenChange }: { user: AuthUser; onOpenChange: (open: boolean) => void }) {
  const [word, setWord] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const wordOk = word === CONFIRM_WORD;
  const emailOk = email === user.email;
  const canDelete = wordOk && emailOk && !deleting;

  const requirement = !wordOk
    ? `Type ${CONFIRM_WORD} to continue`
    : !emailOk
      ? "Now type your email exactly"
      : "Both confirmations match";

  const onConfirm = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await authApi.deleteAccount();
      authApi.logout();
      // Full reload — re-bootstraps auth from scratch, same as the expired-session path.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  };

  return (
    <DialogContent className="max-w-md" hideClose={deleting}>
      <DialogHeader>
        <DialogEyebrow className="text-destructive">Danger zone</DialogEyebrow>
        <DialogTitle>Delete your account</DialogTitle>
        <DialogDescription>
          This permanently deletes your Signarion account. It can&apos;t be undone.
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
        <ul className="list-disc space-y-0.5 pl-4 text-pretty">
          <li>Your profile and sign-in credentials</li>
          <li>Your membership on every shared workspace</li>
          <li>Any pending invitations sent to you</li>
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        Workspaces you own aren&apos;t deleted automatically — delete or hand them off first,
        or this will be blocked.
      </p>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-delete-word">
            Type <span className="font-mono font-semibold text-foreground">{CONFIRM_WORD}</span>
          </Label>
          <Input
            id="confirm-delete-word"
            value={word}
            onChange={(e) => {
              setWord(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={deleting}
            aria-invalid={word.length > 0 && !wordOk}
            className={cn("h-10 font-mono", wordOk && "border-primary/50")}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="confirm-delete-email">
            Type your email: <span className="font-medium text-foreground">{user.email}</span>
          </Label>
          <Input
            id="confirm-delete-email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            spellCheck={false}
            disabled={deleting}
            aria-invalid={email.length > 0 && !emailOk}
            className={cn("h-10", emailOk && "border-primary/50")}
          />
        </div>

        <p
          className={cn(
            "flex items-center gap-2 text-xs font-medium",
            canDelete ? "text-primary" : "text-muted-foreground"
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", canDelete ? "bg-primary" : "bg-muted-foreground/50")}
          />
          {requirement}
        </p>

        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={deleting}>
          Keep account
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={!canDelete}
          className="min-w-36"
        >
          {deleting ? <Spinner /> : <Trash2Icon />}
          {deleting ? "Deleting…" : "Delete forever"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
