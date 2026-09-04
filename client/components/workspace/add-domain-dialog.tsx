"use client";

import { useEffect, useState } from "react";
import { GlobeIcon, ArrowRightIcon, SparklesIcon } from "lucide-react";
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
import { DomainAnalysisLoader } from "@/components/workspace/domain-analysis-loader";
import { IcpEditor, useIcpDraft } from "@/components/workspace/icp-editor";
import { useForm } from "@/hooks/use-form";
import { useWorkspaces } from "@/context/workspaces-context";
import { checkDomain, normalizeDomain } from "@/lib/workspaces";
import type { Icp, Workspace } from "@/types/workspace";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  /** Fires once the reviewed ICP has been saved. */
  onCompleted?: (workspace: Workspace) => void;
}

type Screen =
  | { phase: "form" }
  | { phase: "running" | "error"; domain: string; error?: string }
  | { phase: "review"; domain: string; icp: Icp };

export function AddDomainDialog({ open, onOpenChange, workspace, onCompleted }: Props) {
  return (
    // `disablePointerDismissal` stops a stray backdrop click from killing the run;
    // the body additionally swallows Escape while the crawl is in flight.
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      {/* Remount per open so the flow always starts on the form screen. */}
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
  const { addDomain } = useWorkspaces();
  const [screen, setScreen] = useState<Screen>({ phase: "form" });
  const [runId, setRunId] = useState(0);
  const isRunning = screen.phase === "running";

  const start = async (raw: string) => {
    const domain = normalizeDomain(raw);
    setRunId((n) => n + 1);
    setScreen({ phase: "running", domain });
    try {
      const { generatedIcp } = await addDomain(workspace._id, domain);
      setScreen({ phase: "review", domain, icp: generatedIcp ?? {} });
    } catch (err) {
      setScreen({
        phase: "error",
        domain,
        error: err instanceof Error ? err.message : "The analysis failed.",
      });
    }
  };

  const form = useForm({
    initial: { domain: workspace.trackedDomain ?? "" },
    validate: (v) => ({ domain: checkDomain(v.domain) }),
    onSubmit: (v) => start(v.domain),
  });

  // Guard against closing mid-analysis via Escape.
  useEffect(() => {
    if (!isRunning) return;
    const stop = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.stopPropagation();
    };
    window.addEventListener("keydown", stop, true);
    return () => window.removeEventListener("keydown", stop, true);
  }, [isRunning]);

  if (screen.phase === "review") {
    return (
      <ReviewScreen
        workspace={workspace}
        domain={screen.domain}
        icp={screen.icp}
        onOpenChange={onOpenChange}
        onCompleted={onCompleted}
      />
    );
  }

  if (screen.phase !== "form") {
    return (
      <DialogContent className="max-w-md" hideClose={screen.phase === "running"}>
        <DialogHeader>
          <DialogEyebrow>{workspace.name}</DialogEyebrow>
          <DialogTitle>Analyzing {screen.domain}</DialogTitle>
          <DialogDescription>
            We&apos;re reading the site the way a researcher would — it usually takes a
            minute or two. You can keep this open.
          </DialogDescription>
        </DialogHeader>

        <DomainAnalysisLoader
          key={runId}
          domain={screen.domain}
          phase={screen.phase}
          errorMessage={screen.phase === "error" ? screen.error : null}
          onRetry={() => start(screen.domain)}
          onDismiss={() => onOpenChange(false)}
        />
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogEyebrow>{workspace.name}</DialogEyebrow>
        <DialogTitle>Connect a domain</DialogTitle>
        <DialogDescription>
          This is the company this workspace is about. We analyze its public website to
          draft the ideal-customer profile — you&apos;ll get to review and edit it before
          it&apos;s saved.
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
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={form.submitting}>
            Later
          </Button>
          <Button type="submit" disabled={form.submitting} className="min-w-32">
            {form.submitting ? <Spinner /> : null}
            Analyze domain
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
  icp,
  onOpenChange,
  onCompleted,
}: {
  workspace: Workspace;
  domain: string;
  icp: Icp;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (workspace: Workspace) => void;
}) {
  const { saveIcp } = useWorkspaces();
  const draft = useIcpDraft(icp);
  const [saving, setSaving] = useState<"edited" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persist = async (payload: Icp, which: "edited" | "ai") => {
    if (saving) return;
    setSaving(which);
    setError(null);
    try {
      const updated = await saveIcp(workspace._id, payload);
      toast.success(
        which === "ai" ? "Saved the AI-generated ICP." : "Saved your edited ICP."
      );
      onCompleted?.(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the ICP.");
      setSaving(null);
    }
  };

  return (
    <DialogContent className="max-w-2xl" hideClose={saving !== null}>
      <DialogHeader>
        <DialogEyebrow>
          {workspace.name} · {domain}
        </DialogEyebrow>
        <DialogTitle>Review the generated ICP</DialogTitle>
        <DialogDescription>
          We drafted this profile from {domain}. Edit the JSON to fine-tune it and save your
          version, or let the AI draft stand.
        </DialogDescription>
      </DialogHeader>

      <IcpEditor draft={draft} disabled={saving !== null} />

      {error ? <FormAlert>{error}</FormAlert> : null}

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => persist(icp, "ai")}
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
      </DialogFooter>
    </DialogContent>
  );
}
