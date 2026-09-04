"use client";

import { useState } from "react";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/field";
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
import { useForm } from "@/hooks/use-form";
import { useWorkspaces } from "@/context/workspaces-context";
import { checkWorkspaceName } from "@/lib/workspaces";
import type { Workspace } from "@/types/workspace";

type Mode = "create" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: Mode;
  /** Required for `mode="edit"`. */
  workspace?: Workspace;
  /** Fires after a create with the new workspace (used to chain the domain step). */
  onCreated?: (workspace: Workspace) => void;
  onUpdated?: (workspace: Workspace) => void;
}

export function WorkspaceFormDialog({
  open,
  onOpenChange,
  mode = "create",
  workspace,
  onCreated,
  onUpdated,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* base-ui only mounts the portal while open (and keeps it for the exit
          animation), so FormBody remounts fresh — no manual form reset needed. */}
      <DialogContent className="max-w-md">
        <FormBody
          mode={mode}
          workspace={workspace}
          onDone={() => onOpenChange(false)}
          onCreated={onCreated}
          onUpdated={onUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  mode,
  workspace,
  onDone,
  onCreated,
  onUpdated,
}: {
  mode: Mode;
  workspace?: Workspace;
  onDone: () => void;
  onCreated?: (workspace: Workspace) => void;
  onUpdated?: (workspace: Workspace) => void;
}) {
  const { create, update } = useWorkspaces();
  const [done, setDone] = useState(false);
  const isEdit = mode === "edit";

  const form = useForm({
    initial: { name: isEdit ? workspace?.name ?? "" : "" },
    validate: (v) => ({ name: checkWorkspaceName(v.name) }),
    onSubmit: async (v) => {
      if (done) return;
      if (isEdit && workspace) {
        const next = v.name.trim();
        if (next === workspace.name) {
          onDone();
          return;
        }
        const updated = await update(workspace._id, next);
        setDone(true);
        toast.success("Workspace updated.");
        onUpdated?.(updated);
        onDone();
      } else {
        const created = await create(v.name);
        setDone(true);
        toast.success(`“${created.name}” is ready.`);
        onCreated?.(created);
        onDone();
      }
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogEyebrow>{isEdit ? "Workspace settings" : "New workspace"}</DialogEyebrow>
        <DialogTitle>{isEdit ? "Rename workspace" : "Name your workspace"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "This is the name your team will see across the dashboard."
            : "A workspace holds one company's domain, its ideal-customer profile, and the outreach built from it. Most teams start with one per market or brand."}
        </DialogDescription>
      </DialogHeader>

      <form noValidate onSubmit={form.handleSubmit} className="grid gap-5">
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}

        <Field
          label="Workspace name"
          placeholder="Acme — North America"
          autoFocus
          autoComplete="off"
          maxLength={60}
          disabled={form.submitting || done}
          error={form.errors.name}
          {...form.field("name")}
        />

        {!isEdit ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Next, you&apos;ll connect a domain and we&apos;ll analyze it to build the
            workspace&apos;s customer intelligence.
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onDone}
            disabled={form.submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={form.submitting || done} className="min-w-32">
            {form.submitting ? <Spinner /> : null}
            {isEdit ? "Save changes" : "Create workspace"}
            {!isEdit && !form.submitting ? <ArrowRightIcon /> : null}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
