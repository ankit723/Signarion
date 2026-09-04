"use client";

import { useState } from "react";
import { RotateCcwIcon, SparklesIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useWorkspaces } from "@/context/workspaces-context";
import type { Workspace } from "@/types/workspace";

/**
 * Inline mirror of the background ICP job on the detail page. The full loader /
 * review UI lives in <AddDomainDialog>; `onOpen` opens it.
 */
export function WorkspaceAnalysisStatus({
  workspace,
  onOpen,
}: {
  workspace: Workspace;
  onOpen: () => void;
}) {
  const { discardIcpJob } = useWorkspaces();
  const job = workspace.icpJob;
  const [discarding, setDiscarding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (!job || job.status === "idle") return null;

  // Failed jobs have nothing worth keeping — dismiss immediately. A "ready"
  // draft is a finished ICP the user hasn't accepted yet, so discarding it
  // loses real work and gets a confirmation step.
  const dismissFailed = async () => {
    setDiscarding(true);
    try {
      await discardIcpJob(workspace._id);
      toast.success("Dismissed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't dismiss.");
      setDiscarding(false);
    }
  };

  const discardDraft = async () => {
    await discardIcpJob(workspace._id);
    toast.success("Discarded the draft.");
  };

  if (job.status === "queued" || job.status === "running") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center">
        <Spinner className="size-4 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            Analyzing {job.domain ?? workspace.trackedDomain}
            {job.stage ? <span className="text-muted-foreground"> · {job.stage}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            This runs on our servers — you can leave this page and come back.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpen}>
          View progress
        </Button>
      </div>
    );
  }

  if (job.status === "ready") {
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
        style={{
          borderColor: "var(--ws-accent, var(--primary))",
          background: "color-mix(in oklab, var(--ws-accent, var(--primary)), transparent 94%)",
        }}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg text-primary-foreground"
          style={{ backgroundColor: "var(--ws-accent, var(--primary))" }}
        >
          <SparklesIcon className="size-4" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">A new ICP is ready to review</p>
          <p className="text-xs text-muted-foreground">
            From {job.domain ?? workspace.trackedDomain}. Nothing is saved until you accept it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDiscard(true)}
          >
            <Trash2Icon />
            Discard
          </Button>
          <Button type="button" size="sm" onClick={onOpen}>
            Review
          </Button>
        </div>
        <ConfirmDialog
          open={confirmDiscard}
          onOpenChange={setConfirmDiscard}
          title="Discard this ICP draft?"
          description="The generated profile is thrown away. You can start a new analysis any time, but this draft can't be recovered."
          confirmLabel="Discard draft"
          onConfirm={discardDraft}
        />
      </div>
    );
  }

  // failed
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
      <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="text-sm font-medium text-destructive">Analysis failed</p>
        <p className="text-xs text-muted-foreground">
          {job.error || `Couldn't analyze ${job.domain ?? workspace.trackedDomain}.`}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={dismissFailed} disabled={discarding}>
          {discarding ? <Spinner /> : <Trash2Icon />}
          Dismiss
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onOpen}>
          <RotateCcwIcon />
          Try again
        </Button>
      </div>
    </div>
  );
}
