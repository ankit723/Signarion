"use client";

import { useState } from "react";
import { GlobeIcon, ArrowRightIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { DomainAnalysisLoader } from "@/components/workspace/domain-analysis-loader";
import { IcpEditor, useIcpDraft } from "@/components/workspace/icp-editor";
import { useForm } from "@/hooks/use-form";
import { useWorkspaces } from "@/context/workspaces-context";
import { checkDomain } from "@/lib/workspaces";
import type { Icp, Workspace } from "@/types/workspace";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  /** Fires once the reviewed ICP has been saved. */
  onCompleted?: (workspace: Workspace) => void;
}

export function AddDomainDialog({ open, onOpenChange, workspace, onCompleted }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      {open ? (
        <Body workspace={workspace} onOpenChange={onOpenChange} onCompleted={onCompleted} />
      ) : null}
    </Dialog>
  );
}

function Body({
  workspace,
  onOpenChange,
  onCompleted,
}: {
  workspace: Workspace;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (workspace: Workspace) => void;
}) {
  const { startAnalysis, discardIcpJob } = useWorkspaces();
  const job = workspace.icpJob ?? { status: "idle" as const };
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const begin = async (domain: string) => {
    setSubmitting(true);
    setActionError(null);
    try {
      await startAnalysis(workspace._id, domain);
      // The workspace's icpJob is now "queued" in the cache — the screen below
      // switches to the loader, and the provider polls until it's ready.
    } finally {
      setSubmitting(false);
    }
  };

  const form = useForm({
    initial: { domain: job.domain ?? workspace.trackedDomain ?? "" },
    validate: (v) => ({ domain: checkDomain(v.domain) }),
    onSubmit: (v) => begin(v.domain),
  });

  // ---- Ready to review -------------------------------------------------
  if (job.status === "ready") {
    if (!job.draft) {
      return (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogEyebrow>{workspace.name}</DialogEyebrow>
            <DialogTitle>Loading the draft…</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-10">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        </DialogContent>
      );
    }
    return (
      <ReviewScreen
        workspace={workspace}
        domain={job.domain ?? workspace.trackedDomain ?? ""}
        draft={job.draft}
        onOpenChange={onOpenChange}
        onCompleted={onCompleted}
      />
    );
  }

  // ---- Running (in the background) -----------------------------------
  if (submitting || job.status === "queued" || job.status === "running") {
    return (
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogEyebrow>{workspace.name}</DialogEyebrow>
          <DialogTitle>Analyzing {job.domain ?? form.values.domain}</DialogTitle>
          <DialogDescription>
            This runs on our servers — you can close this window or leave the site and it
            keeps going. We&apos;ll have the profile ready for you to review.
          </DialogDescription>
        </DialogHeader>

        <DomainAnalysisLoader
          domain={job.domain ?? form.values.domain}
          phase="running"
          note={job.stage ? `${job.stage} · running in the background` : "Running in the background"}
        />

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Run in the background
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  // ---- Failed -------------------------------------------------------
  if (job.status === "failed") {
    return (
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogEyebrow>{workspace.name}</DialogEyebrow>
          <DialogTitle>Analysis failed</DialogTitle>
          <DialogDescription>
            We couldn&apos;t finish analyzing {job.domain ?? "the domain"}. Try again, or
            dismiss and connect a different domain.
          </DialogDescription>
        </DialogHeader>

        <DomainAnalysisLoader
          domain={job.domain ?? workspace.trackedDomain ?? ""}
          phase="error"
          errorMessage={job.error}
          onRetry={() => begin(job.domain ?? workspace.trackedDomain ?? "")}
          onDismiss={() => onOpenChange(false)}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              try {
                await discardIcpJob(workspace._id);
              } catch (err) {
                setActionError(err instanceof Error ? err.message : "Couldn't dismiss.");
              }
            }}
          >
            <Trash2Icon />
            Dismiss
          </Button>
        </DialogFooter>
        {actionError ? <FormAlert>{actionError}</FormAlert> : null}
      </DialogContent>
    );
  }

  // ---- Form -------------------------------------------------------
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogEyebrow>{workspace.name}</DialogEyebrow>
        <DialogTitle>Connect a domain</DialogTitle>
        <DialogDescription>
          This is the company this workspace is about. We analyze its public website to
          draft the ideal-customer profile — the analysis runs in the background and
          you&apos;ll review it before it&apos;s saved.
        </DialogDescription>
      </DialogHeader>

      <form noValidate onSubmit={form.handleSubmit} className="grid gap-5">
        {form.formError ? <FormAlert>{form.formError}</FormAlert> : null}

        <Field
          label="Domain"
          icon={GlobeIcon}
          placeholder="acme.com"
          autoFocus
          autoComplete="off"
          inputMode="url"
          disabled={form.submitting}
          error={form.errors.domain}
          {...form.field("domain")}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={form.submitting}
          >
            Later
          </Button>
          <Button type="submit" disabled={form.submitting} className="min-w-32">
            {form.submitting ? <Spinner /> : null}
            Start analysis
            {form.submitting ? null : <ArrowRightIcon />}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ReviewScreen({
  workspace,
  domain,
  draft: rawDraft,
  onOpenChange,
  onCompleted,
}: {
  workspace: Workspace;
  domain: string;
  draft: Icp;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (workspace: Workspace) => void;
}) {
  const { saveIcp, discardIcpJob } = useWorkspaces();
  const draft = useIcpDraft(rawDraft);
  const [saving, setSaving] = useState<"edited" | "ai" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const persist = async (payload: Icp, which: "edited" | "ai") => {
    if (saving) return;
    setSaving(which);
    setError(null);
    try {
      const updated = await saveIcp(workspace._id, payload);
      toast.success(which === "ai" ? "Saved the AI-generated ICP." : "Saved your edited ICP.");
      onCompleted?.(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the ICP.");
      setSaving(null);
    }
  };

  const discard = async () => {
    await discardIcpJob(workspace._id);
    toast.success("Discarded the draft.");
    onOpenChange(false);
  };

  return (
    <DialogContent className="max-w-2xl" hideClose={saving !== null}>
      <DialogHeader>
        <DialogEyebrow>
          {workspace.name} · {domain}
        </DialogEyebrow>
        <DialogTitle>Review the generated ICP</DialogTitle>
        <DialogDescription>
          We drafted this profile from {domain}. Fine-tune it with the guided form (or JSON)
          and save your version, or let the AI draft stand.
        </DialogDescription>
      </DialogHeader>

      <IcpEditor draft={draft} disabled={saving !== null} />

      {error ? <FormAlert>{error}</FormAlert> : null}

      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmDiscard(true)}
          disabled={saving !== null}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2Icon />
          Discard
        </Button>
        <ConfirmDialog
          open={confirmDiscard}
          onOpenChange={setConfirmDiscard}
          title="Discard this ICP draft?"
          description="The generated profile is thrown away. You can start a new analysis any time, but this draft can't be recovered."
          confirmLabel="Discard draft"
          onConfirm={discard}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => persist(rawDraft, "ai")}
            disabled={saving !== null}
          >
            {saving === "ai" ? <Spinner /> : <SparklesIcon />}
            Let AI decide
          </Button>
          <Button
            type="button"
            onClick={() => persist(draft.value, "edited")}
            disabled={!draft.dirty || draft.blocked || saving !== null}
            className="min-w-36"
          >
            {saving === "edited" ? <Spinner /> : null}
            Save edited ICP
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
