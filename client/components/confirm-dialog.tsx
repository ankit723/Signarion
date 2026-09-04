"use client";

import { useState } from "react";
import { TriangleAlertIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormAlert } from "@/components/form-alert";
import { Spinner } from "@/components/ui/spinner";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" (red, default) or "default" for a non-destructive confirm. */
  tone?: "destructive" | "default";
  icon?: LucideIcon;
  /** Do the actual work here. Throw to keep the dialog open and show the error. */
  onConfirm: () => Promise<void>;
}

/**
 * A one-click-but-not-zero-click confirmation for moderately destructive
 * actions (remove a member, cancel an invite, discard a draft). For the most
 * severe, hard-to-undo actions (delete a workspace, delete an account), use a
 * type-to-confirm dialog instead — see delete-workspace-dialog.tsx.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "destructive",
  icon: Icon = TriangleAlertIcon,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <Body
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          tone={tone}
          icon={Icon}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  );
}

function Body({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone,
  icon: Icon,
  onOpenChange,
  onConfirm,
}: Omit<ConfirmDialogProps, "open"> & { icon: LucideIcon }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-w-md" hideClose={busy}>
      <DialogHeader className="flex-row items-start gap-3 pr-0">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg",
            tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="space-y-1.5 pr-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
      </DialogHeader>

      {error ? <FormAlert>{error}</FormAlert> : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === "destructive" ? "destructive" : "default"}
          onClick={confirm}
          disabled={busy}
          className="min-w-28"
        >
          {busy ? <Spinner /> : null}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
