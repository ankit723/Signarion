"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, GlobeIcon, PencilIcon, RadarIcon, Trash2Icon } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { AddDomainDialog } from "@/components/workspace/add-domain-dialog";
import { DeleteWorkspaceDialog } from "@/components/workspace/delete-workspace-dialog";
import { EmptyShell } from "@/components/workspace/empty-shell";
import { WorkspaceAnalysisStatus } from "@/components/workspace/workspace-analysis-status";
import { WorkspaceFormDialog } from "@/components/workspace/workspace-form-dialog";
import { WorkspaceMembers } from "@/components/workspace/workspace-members";
import { useAuth } from "@/context/auth-context";
import { useWorkspaceDetail } from "@/hooks/use-workspace-detail";

export function WorkspaceSettings() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user } = useAuth();
  const { workspace, notFound, setFetched } = useWorkspaceDetail(id);

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);

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

  const isOwner = workspace.role === "owner";

  return (
    <div className="space-y-8">
      <Reveal>
        <LinkButton
          href={`/dashboard/workspaces/${workspace._id}`}
          variant="ghost"
          size="sm"
          className="-ml-2.5 mb-3 text-muted-foreground"
        >
          <ArrowLeftIcon />
          {workspace.name}
        </LinkButton>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Workspace
        </p>
        <h1 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the domain, name, members, and lifecycle of {workspace.name}.
        </p>
      </Reveal>

      <Reveal delay={40}>
        <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-sm font-semibold tracking-tight">
                Domain & analysis
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <GlobeIcon className="size-3.5" />
                {workspace.trackedDomain || "No domain connected"}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setDomainOpen(true)}>
              <RadarIcon />
              {workspace.trackedDomain ? "Re-analyze" : "Connect domain"}
            </Button>
          </div>

          {workspace.icpJob && workspace.icpJob.status !== "idle" ? (
            <div className="mt-4">
              <WorkspaceAnalysisStatus workspace={workspace} onOpen={() => setDomainOpen(true)} />
            </div>
          ) : null}
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-sm font-semibold tracking-tight">General</h2>
              <p className="mt-1 text-sm text-muted-foreground">The name shown across the dashboard.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setRenameOpen(true)}>
              <PencilIcon />
              Rename
            </Button>
          </div>
        </section>
      </Reveal>

      <Reveal delay={120}>
        <WorkspaceMembers workspace={workspace} currentUid={user?.uid ?? ""} />
      </Reveal>

      {isOwner ? (
        <Reveal delay={160}>
          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-destructive">
              Danger zone
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete this workspace. This can&apos;t be undone.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mt-4"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon />
              Delete workspace
            </Button>
          </section>
        </Reveal>
      ) : null}

      <WorkspaceFormDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        mode="edit"
        workspace={workspace}
        onUpdated={(w) => setFetched(w)}
      />
      <DeleteWorkspaceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workspace={workspace}
        onDeleted={() => router.replace("/dashboard")}
      />
      <AddDomainDialog
        open={domainOpen}
        onOpenChange={setDomainOpen}
        workspace={workspace}
        onCompleted={(w) => setFetched(w)}
      />
    </div>
  );
}
