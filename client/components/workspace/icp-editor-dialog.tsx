"use client";

import { useState } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/form-alert";
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
import { Spinner } from "@/components/ui/spinner";
import { IcpEditor, useIcpDraft } from "@/components/workspace/icp-editor";
import { useWorkspaces } from "@/context/workspaces-context";
import type { Workspace } from "@/types/workspace";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  onSaved?: (workspace: Workspace) => void;
}

/** "Edit ICP" — opens the saved ICP in the guided editor (or raw JSON). */
export function IcpEditorDialog({ open, onOpenChange, workspace, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <Body workspace={workspace} onOpenChange={onOpenChange} onSaved={onSaved} />
      ) : null}
    </Dialog>
  );
}

function Body({
  workspace,
  onOpenChange,
  onSaved,
}: {
  workspace: Workspace;
  onOpenChange: (open: boolean) => void;
  onSaved?: (workspace: Workspace) => void;
}) {
  const { saveIcp } = useWorkspaces();
  const draft = useIcpDraft(workspace.icp ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving || draft.blocked) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await saveIcp(workspace._id, draft.value);
      toast.success("ICP updated.");
      onSaved?.(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the ICP.");
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl" hideClose={saving}>
      <DialogHeader>
        <DialogEyebrow>{workspace.name}</DialogEyebrow>
        <DialogTitle>Edit ICP</DialogTitle>
        <DialogDescription>
          Fine-tune the ideal-customer profile field by field, or switch to JSON.
        </DialogDescription>
      </DialogHeader>

      <IcpEditor draft={draft} disabled={saving} />

      {error ? <FormAlert>{error}</FormAlert> : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={!draft.dirty || saving || draft.blocked}
          className="min-w-28"
        >
          {saving ? <Spinner /> : null}
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
