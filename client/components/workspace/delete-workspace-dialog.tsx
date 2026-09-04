"use client";

import { useState } from "react";
import { TriangleAlertIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

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
import { useWorkspaces } from "@/context/workspaces-context";
import type { Workspace } from "@/types/workspace";

const CONFIRM_WORD = "DELETE";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  /** Called after a successful delete (e.g. to leave the details page). */
  onDeleted?: () => void;
}

export function DeleteWorkspaceDialog({ open, onOpenChange, workspace, onDeleted }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <Body workspace={workspace} onOpenChange={onOpenChange} onDeleted={onDeleted} />
      ) : null}
    </Dialog>
  );
}

function Body({
  workspace,
  onOpenChange,
  onDeleted,
}: {
  workspace: Workspace;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { remove } = useWorkspaces();
  const [word, setWord] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Exact, case-sensitive matches on both fields.
  const wordOk = word === CONFIRM_WORD;
  const nameOk = name === workspace.name;
  const canDelete = wordOk && nameOk && !deleting;

  const requirement = !wordOk
    ? `Type ${CONFIRM_WORD} to continue`
    : !nameOk
      ? "Now type the workspace name exactly"
      : "Both confirmations match";

  const onConfirm = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await remove(workspace._id);
      toast.success(`“${workspace.name}” deleted.`);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the workspace.");
      setDeleting(false);
    }
  };

  return (
    <DialogContent className="max-w-md" hideClose={deleting}>
      <DialogHeader>
        <DialogEyebrow className="text-destructive">Danger zone</DialogEyebrow>
        <DialogTitle>Delete this workspace</DialogTitle>
        <DialogDescription>
          This permanently removes <span className="font-medium text-foreground">{workspace.name}</span>{" "}
          and everything tied to it. It can&apos;t be undone.
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
        <ul className="list-disc space-y-0.5 pl-4 text-pretty">
          <li>The connected domain{workspace.trackedDomain ? ` (${workspace.trackedDomain})` : ""}</li>
          <li>The generated ideal-customer profile</li>
          <li>Member access for everyone on the workspace</li>
        </ul>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-word">
            Type <span className="font-mono font-semibold text-foreground">{CONFIRM_WORD}</span>
          </Label>
          <Input
            id="confirm-word"
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
          <Label htmlFor="confirm-name">
            Type the workspace name: <span className="font-medium text-foreground">{workspace.name}</span>
          </Label>
          <Input
            id="confirm-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            spellCheck={false}
            disabled={deleting}
            aria-invalid={name.length > 0 && !nameOk}
            className={cn("h-10", nameOk && "border-primary/50")}
          />
        </div>

        <p
          className={cn(
            "flex items-center gap-2 text-xs font-medium",
            canDelete ? "text-primary" : "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              canDelete ? "bg-primary" : "bg-muted-foreground/50"
            )}
          />
          {requirement}
        </p>

        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={deleting}>
          Keep workspace
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
