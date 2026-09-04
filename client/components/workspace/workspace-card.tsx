"use client";

import Link from "next/link";
import { ArrowUpRightIcon, GlobeIcon, SparklesIcon, ClockIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { hasIcp, type Workspace } from "@/types/workspace";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "W";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

function relativeTime(value?: string): string | null {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const icpReady = hasIcp(workspace);
  const domain = workspace.trackedDomain;
  const updated = relativeTime(workspace.updatedAt ?? workspace.createdAt);

  return (
    <Link
      href={`/dashboard/workspaces/${workspace._id}`}
      className={cn(
        "group/ws relative flex h-full flex-col gap-4 overflow-hidden rounded-xl bg-card p-5 text-sm text-card-foreground ring-1 ring-foreground/10",
        "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5 hover:ring-foreground/20",
        "active:scale-[0.985] active:duration-110",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px scale-x-0 bg-primary/60 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ws:scale-x-100"
      />

      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary font-heading text-sm font-semibold text-primary-foreground"
        >
          {initials(workspace.name)}
        </span>
        <ArrowUpRightIcon className="size-4 text-muted-foreground/50 transition-[color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ws:-translate-y-0.5 group-hover/ws:translate-x-0.5 group-hover/ws:text-foreground motion-reduce:group-hover/ws:translate-x-0 motion-reduce:group-hover/ws:translate-y-0" />
      </div>

      <div className="min-w-0 space-y-1">
        <h3 className="truncate font-heading text-base font-medium tracking-tight">
          {workspace.name}
        </h3>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <GlobeIcon className="size-3.5 shrink-0" />
          {domain ? domain : <span className="italic">No domain connected</span>}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <Badge variant={icpReady ? "secondary" : "outline"} className="gap-1 font-normal">
          <SparklesIcon className={cn("size-3", icpReady && "text-primary")} />
          {icpReady ? "ICP ready" : domain ? "Analyzing" : "ICP pending"}
        </Badge>
        {updated ? (
          <span className="flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            <ClockIcon className="size-3" />
            {updated}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function WorkspaceCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between">
        <div className="size-10 animate-pulse rounded-lg bg-muted" />
        <div className="size-4 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-12 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
