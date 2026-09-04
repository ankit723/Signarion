"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  ClockIcon,
  GlobeIcon,
  Loader2Icon,
  SparklesIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { brandVars, workspaceAccent, workspaceFavicon } from "@/lib/brand";
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

function StatusBadge({
  workspace,
  accent,
}: {
  workspace: Workspace;
  accent: string | null;
}) {
  const job = workspace.icpJob?.status ?? "idle";
  const icpReady = hasIcp(workspace);

  if (job === "queued" || job === "running") {
    return (
      <Badge variant="secondary" className="gap-1 font-normal">
        <Loader2Icon className="size-3 animate-spin motion-reduce:animate-none" />
        Analyzing…
      </Badge>
    );
  }
  if (job === "ready") {
    return (
      <Badge
        variant="outline"
        className="gap-1 font-medium"
        style={
          accent
            ? { color: "var(--ws-accent)", borderColor: "var(--ws-accent)" }
            : { color: "var(--primary)", borderColor: "var(--primary)" }
        }
      >
        <SparklesIcon className="size-3" />
        Review ICP
      </Badge>
    );
  }
  if (job === "failed") {
    return (
      <Badge variant="destructive" className="gap-1 font-normal">
        <TriangleAlertIcon className="size-3" />
        Analysis failed
      </Badge>
    );
  }
  return (
    <Badge variant={icpReady ? "secondary" : "outline"} className="gap-1 font-normal">
      <SparklesIcon className={cn("size-3", icpReady && "text-primary")} />
      {icpReady ? "ICP ready" : workspace.trackedDomain ? "No profile yet" : "ICP pending"}
    </Badge>
  );
}

export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const domain = workspace.trackedDomain;
  const updated = relativeTime(workspace.updatedAt ?? workspace.createdAt);

  const accent = workspaceAccent(workspace);
  const vars = brandVars(workspace);
  const favicon = workspaceFavicon(workspace);
  const [faviconOk, setFaviconOk] = useState(true);
  const showFavicon = Boolean(favicon) && faviconOk;

  return (
    <Link
      href={`/dashboard/workspaces/${workspace._id}`}
      style={vars}
      className={cn(
        "group/ws relative flex h-full flex-col gap-4 overflow-hidden rounded-xl bg-card p-5 text-sm text-card-foreground ring-1 ring-foreground/10",
        "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-0.5",
        "active:scale-[0.985] active:duration-110",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
        accent
          ? "hover:shadow-[0_14px_36px_-14px_var(--ws-accent)] hover:ring-[color-mix(in_oklab,var(--ws-accent),transparent_55%)]"
          : "hover:shadow-lg hover:shadow-foreground/5 hover:ring-foreground/20"
      )}
    >
      {/* ambient top sheen — present even without a brand accent, so flat workspaces don't look bare */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-foreground/[0.035] to-transparent"
      />

      {/* persistent brand chrome: left edge + tinted header wash */}
      {accent ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-(--ws-accent)"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-(--ws-tint) to-transparent"
          />
          {/* accent glow on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ws:opacity-100 motion-reduce:transition-none"
            style={{
              background:
                "radial-gradient(120% 60% at 50% 0%, color-mix(in oklab, var(--ws-accent), transparent 86%), transparent 70%)",
            }}
          />
        </>
      ) : null}

      {/* top border accent — grows in on hover */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ws:scale-x-100 motion-reduce:transition-none",
          accent ? "bg-(--ws-accent)" : "bg-primary/60"
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        {showFavicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={favicon as string}
            alt=""
            width={44}
            height={44}
            referrerPolicy="no-referrer"
            onError={() => setFaviconOk(false)}
            className="size-11 shrink-0 rounded-xl bg-card object-contain p-1.5 ring-1 ring-foreground/10 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ws:scale-105 motion-reduce:transition-none motion-reduce:group-hover/ws:scale-100"
            style={accent ? { boxShadow: "0 0 0 1px var(--ws-tint-strong)" } : undefined}
          />
        ) : (
          <span
            aria-hidden
            className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary font-heading text-sm font-semibold text-primary-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ws:scale-105 motion-reduce:transition-none motion-reduce:group-hover/ws:scale-100"
            style={accent ? { backgroundColor: "var(--ws-accent)" } : undefined}
          >
            <span className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/25 via-transparent to-black/10" />
            <span className="relative">{initials(workspace.name)}</span>
          </span>
        )}
        <span className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/50 transition-[color,background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/ws:-translate-y-0.5 group-hover/ws:translate-x-0.5 group-hover/ws:bg-foreground/5 group-hover/ws:text-foreground motion-reduce:group-hover/ws:translate-x-0 motion-reduce:group-hover/ws:translate-y-0">
          <ArrowUpRightIcon className="size-4" />
        </span>
      </div>

      <div className="relative min-w-0 space-y-1.5">
        <h3
          className={cn(
            "truncate font-heading text-base font-semibold tracking-tight transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            accent && "group-hover/ws:text-(--ws-accent)"
          )}
        >
          {workspace.name}
        </h3>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <GlobeIcon className="size-3.5 shrink-0" />
          {domain ? (
            <span className="truncate font-mono">{domain}</span>
          ) : (
            <span className="text-muted-foreground/70">No domain connected</span>
          )}
        </p>
        {workspace.role === "member" && workspace.ownerInfo ? (
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <UserRoundIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {workspace.ownerInfo.displayName || workspace.ownerInfo.email || "Unknown owner"}
              {workspace.ownerInfo.displayName && workspace.ownerInfo.email ? (
                <span className="text-muted-foreground/70"> · {workspace.ownerInfo.email}</span>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>

      <div className="relative mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <StatusBadge workspace={workspace} accent={accent} />
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
        <div className="size-11 animate-pulse rounded-xl bg-muted" />
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
