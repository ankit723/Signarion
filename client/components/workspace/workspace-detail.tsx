"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, BracesIcon, GlobeIcon, SettingsIcon, SparklesIcon } from "lucide-react";

import { brandVars, workspaceAccent, workspaceFavicon } from "@/lib/brand";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyShell } from "@/components/workspace/empty-shell";
import { IcpEditorDialog } from "@/components/workspace/icp-editor-dialog";
import { IcpReport } from "@/components/workspace/icp-report";
import { useWorkspaceDetail } from "@/hooks/use-workspace-detail";
import { hasIcp } from "@/types/workspace";

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function WorkspaceDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { workspace, notFound, setFetched } = useWorkspaceDetail(id);

  const [icpOpen, setIcpOpen] = useState(false);
  const [favOk, setFavOk] = useState(true);

  if (!workspace) {
    if (notFound) {
      return (
        <EmptyShell
          title="Workspace not found"
          body="It may have been deleted, or you don't have access to it."
        >
          <LinkButton href="/dashboard">
            <ArrowLeftIcon />
            Back to dashboard
          </LinkButton>
        </EmptyShell>
      );
    }
    return (
      <div className="flex min-h-[40svh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Loading workspace…
      </div>
    );
  }

  const icpReady = hasIcp(workspace);
  const accent = workspaceAccent(workspace);
  const favicon = workspaceFavicon(workspace);
  const showFavicon = Boolean(favicon) && favOk;
  const analysisInProgress = Boolean(workspace.icpJob && workspace.icpJob.status !== "idle");

  return (
    <div className="relative space-y-8" style={brandVars(workspace)}>
      {accent ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 left-0 h-1 w-24 rounded-full bg-(--ws-accent)"
        />
      ) : null}

      <Link
        href="/dashboard"
        className="group/back inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/back:-translate-x-0.5 motion-reduce:group-hover/back:translate-x-0" />
        Workspaces
      </Link>

      <Reveal className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {showFavicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={favicon as string}
              alt=""
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              onError={() => setFavOk(false)}
              className="mt-0.5 size-10 shrink-0 rounded-lg bg-card object-contain p-1 ring-1 ring-foreground/10"
            />
          ) : (
            <span
              aria-hidden
              className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-primary font-heading text-sm font-semibold text-primary-foreground"
              style={accent ? { backgroundColor: "var(--ws-accent)" } : undefined}
            >
              {workspace.name.trim().slice(0, 2).toUpperCase() || "W"}
            </span>
          )}
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">{workspace.name}</h1>
              <Badge variant="outline" className="font-mono uppercase tracking-wide">
                {workspace.role}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <GlobeIcon className="size-3.5" />
                {workspace.trackedDomain || "No domain connected"}
              </span>
              <span>Created {formatDate(workspace.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {icpReady ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setIcpOpen(true)}>
              <BracesIcon />
              Edit ICP
            </Button>
          ) : null}
          <LinkButton
            href={`/dashboard/workspaces/${workspace._id}/settings`}
            variant="outline"
            size="sm"
            className="relative"
          >
            <SettingsIcon />
            Settings
            {analysisInProgress ? (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 size-2 rounded-full bg-primary ring-2 ring-background"
              />
            ) : null}
          </LinkButton>
        </div>
      </Reveal>

      {icpReady ? (
        <IcpReport icp={workspace.icp!} />
      ) : (
        <Reveal delay={60}>
          <EmptyShell
            title={
              analysisInProgress
                ? "Analysis in progress"
                : workspace.trackedDomain
                  ? "No profile yet"
                  : "Connect a domain to begin"
            }
            body={
              analysisInProgress
                ? "We're analyzing this workspace's domain in the background. Check settings for live progress, or come back shortly."
                : workspace.trackedDomain
                  ? "We have a domain on file but no ideal-customer profile came back. Head to settings to run the analysis again."
                  : "Add the company's website in settings and we'll analyze it to generate this workspace's ideal-customer profile, buyer personas, and outreach signals."
            }
          >
            <LinkButton href={`/dashboard/workspaces/${workspace._id}/settings`}>
              <SparklesIcon />
              Go to settings
            </LinkButton>
          </EmptyShell>
        </Reveal>
      )}

      <IcpEditorDialog
        open={icpOpen}
        onOpenChange={setIcpOpen}
        workspace={workspace}
        onSaved={(w) => setFetched(w)}
      />
    </div>
  );
}
