"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BracesIcon,
  GlobeIcon,
  PencilIcon,
  RadarIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { AddDomainDialog } from "@/components/workspace/add-domain-dialog";
import { DeleteWorkspaceDialog } from "@/components/workspace/delete-workspace-dialog";
import { IcpEditorDialog } from "@/components/workspace/icp-editor-dialog";
import { IcpReport } from "@/components/workspace/icp-report";
import { WorkspaceFormDialog } from "@/components/workspace/workspace-form-dialog";
import { useWorkspaces } from "@/context/workspaces-context";
import { workspaceApi } from "@/lib/workspaces";
import { hasIcp, type Workspace } from "@/types/workspace";

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
  const router = useRouter();
  const { status, getCached, put } = useWorkspaces();

  const cached = getCached(id);
  const [fetched, setFetched] = useState<Workspace | null>(null);
  const [notFound, setNotFound] = useState(false);
  const fetchingRef = useRef(false);

  const workspace = cached ?? fetched;

  // Direct navigation / hard refresh: the list cache may not have this one yet.
  // (This component is keyed by id, so the ref resets on navigation.)
  useEffect(() => {
    if (cached || fetchingRef.current || notFound || status !== "ready") return;
    fetchingRef.current = true;
    let alive = true;
    workspaceApi
      .get(id)
      .then((w) => {
        if (alive) {
          setFetched(w);
          put(w);
        }
      })
      .catch(() => {
        if (alive) setNotFound(true);
      })
      .finally(() => {
        fetchingRef.current = false;
      });
    return () => {
      alive = false;
    };
  }, [id, cached, notFound, status, put]);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [icpOpen, setIcpOpen] = useState(false);

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

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className="group/back inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/back:-translate-x-0.5 motion-reduce:group-hover/back:translate-x-0" />
        Workspaces
      </Link>

      <Reveal className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
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

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDomainOpen(true)}>
            <RadarIcon />
            {workspace.trackedDomain ? "Re-analyze" : "Connect domain"}
          </Button>
          {icpReady ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setIcpOpen(true)}>
              <BracesIcon />
              Edit ICP
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <PencilIcon />
            Rename
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon />
            Delete
          </Button>
        </div>
      </Reveal>

      {icpReady ? (
        <IcpReport icp={workspace.icp!} />
      ) : (
        <Reveal delay={60}>
          <EmptyShell
            title={workspace.trackedDomain ? "No profile yet" : "Connect a domain to begin"}
            body={
              workspace.trackedDomain
                ? "We have a domain on file but no ideal-customer profile came back. Run the analysis again to build it."
                : "Add the company's website and we'll analyze it to generate this workspace's ideal-customer profile, buyer personas, and outreach signals."
            }
          >
            <Button type="button" onClick={() => setDomainOpen(true)}>
              <SparklesIcon />
              {workspace.trackedDomain ? "Re-run analysis" : "Analyze a domain"}
            </Button>
          </EmptyShell>
        </Reveal>
      )}

      <WorkspaceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        workspace={workspace}
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
      <IcpEditorDialog
        open={icpOpen}
        onOpenChange={setIcpOpen}
        workspace={workspace}
        onSaved={(w) => setFetched(w)}
      />
    </div>
  );
}

function EmptyShell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-card ring-1 ring-foreground/10">
        <SparklesIcon className="size-5 text-primary" />
      </span>
      <div className="max-w-md space-y-1.5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground text-pretty">{body}</p>
      </div>
      {children}
    </div>
  );
}
