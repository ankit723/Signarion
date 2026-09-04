"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleAlertIcon,
  PlusIcon,
  RefreshCwIcon,
  LayoutGridIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { AddDomainDialog } from "@/components/workspace/add-domain-dialog";
import { WorkspaceCard, WorkspaceCardSkeleton } from "@/components/workspace/workspace-card";
import { WorkspaceFormDialog } from "@/components/workspace/workspace-form-dialog";
import { useAuth } from "@/context/auth-context";
import { useWorkspaces } from "@/context/workspaces-context";
import { ROUTES, authApi } from "@/lib/auth";
import type { Workspace } from "@/types/workspace";

const ONBOARDED_KEY = "sbo.ws.onboarded";

export function WorkspacesDashboard() {
  const { user, resync } = useAuth();
  const { items, status, error, refreshing, refresh, getCached } = useWorkspaces();

  const [createOpen, setCreateOpen] = useState(false);
  const [domainFor, setDomainFor] = useState<Workspace | null>(null);
  const [resending, setResending] = useState(false);
  const onboardedRef = useRef(false);

  const owned = useMemo(() => items.filter((w) => w.role === "owner"), [items]);
  const shared = useMemo(() => items.filter((w) => w.role === "member"), [items]);

  const resendVerification = async () => {
    setResending(true);
    try {
      const message = await authApi.resendVerification();
      toast.success(message || "Verification email sent.");
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_VERIFIED") {
        toast.success("Your email is already verified.");
        await resync();
      } else {
        toast.error(err instanceof Error ? err.message : "Couldn't send the email.");
      }
    } finally {
      setResending(false);
    }
  };

  // First-run nudge: a brand-new user with no workspaces gets the create flow
  // opened for them once. Never fires for users who already have workspaces.
  useEffect(() => {
    if (status !== "ready" || items.length > 0 || onboardedRef.current) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {
      /* private mode — fall back to once-per-mount */
    }
    if (seen) return;
    onboardedRef.current = true;
    try {
      sessionStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* ignore */
    }
    setCreateOpen(true);
  }, [status, items.length]);

  const firstName = user?.displayName?.split(" ")[0];

  return (
    <div className="space-y-8">
      {user && !user.emailVerified ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-4 text-sm sm:flex-row sm:items-center">
          <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
          <p className="flex-1">
            Verify <span className="font-medium">{user.email}</span> to unlock every feature.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resendVerification}
              disabled={resending}
            >
              {resending ? <Spinner /> : null}
              Resend email
            </Button>
            <LinkButton href={ROUTES.verify} size="sm">
              Verify
            </LinkButton>
          </div>
        </div>
      ) : null}

      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
          </p>
          <h1 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight">
            Workspaces
            {status === "ready" && items.length > 0 ? (
              <span className="ml-2 align-middle font-mono text-sm font-normal text-muted-foreground">
                {items.length}
              </span>
            ) : null}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {status === "ready" && items.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCwIcon className={cn("size-4", refreshing && "animate-spin")} />
            </Button>
          ) : null}
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            New workspace
          </Button>
        </div>
      </Reveal>

      {status === "loading" ? (
        <Grid>
          {Array.from({ length: 4 }).map((_, i) => (
            <WorkspaceCardSkeleton key={i} />
          ))}
        </Grid>
      ) : status === "error" ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-card ring-1 ring-foreground/10">
            <CircleAlertIcon className="size-5 text-destructive" />
          </span>
          <div className="max-w-sm space-y-1">
            <h2 className="font-heading text-base font-semibold">Couldn&apos;t load your workspaces</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            <RefreshCwIcon />
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Reveal>
          <EmptyState onCreate={() => setCreateOpen(true)} />
        </Reveal>
      ) : (
        <div className="space-y-10">
          <WorkspaceSection title="Your workspaces" items={owned}>
            {shared.length > 0 ? (
              <Reveal className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  You don&apos;t have any workspaces of your own yet.
                </p>
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  <PlusIcon />
                  New workspace
                </Button>
              </Reveal>
            ) : null}
          </WorkspaceSection>

          {shared.length > 0 ? (
            <WorkspaceSection
              title="Shared with you"
              subtitle="Workspaces other people invited you to."
              items={shared}
            />
          ) : null}
        </div>
      )}

      <WorkspaceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onCreated={(w) => {
          setCreateOpen(false);
          setDomainFor(w);
        }}
      />
      {domainFor ? (
        <AddDomainDialog
          open={Boolean(domainFor)}
          onOpenChange={(open) => !open && setDomainFor(null)}
          /* live copy so the poll-driven icpJob updates reach the dialog */
          workspace={getCached(domainFor._id) ?? domainFor}
        />
      ) : null}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function WorkspaceSection({
  title,
  subtitle,
  items,
  children,
}: {
  title: string;
  subtitle?: string;
  items: Workspace[];
  /** Rendered instead of the grid when `items` is empty. */
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <Reveal className="flex items-baseline gap-2">
        <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
        <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
        {subtitle ? (
          <span className="hidden text-xs text-muted-foreground sm:inline">· {subtitle}</span>
        ) : null}
      </Reveal>

      {items.length === 0 ? (
        children
      ) : (
        <Grid>
          {items.map((w, i) => (
            <Reveal key={w._id} delay={Math.min(i, 8) * 55}>
              <WorkspaceCard workspace={w} />
            </Reveal>
          ))}
        </Grid>
      )}
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16">
      <div className="relative mx-auto flex max-w-md flex-col items-center gap-5 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-card ring-1 ring-foreground/10">
          <LayoutGridIcon className="size-6 text-primary" />
        </span>
        <div className="space-y-1.5">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Create your first workspace
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            A workspace is where a company&apos;s domain, its ideal-customer profile, and
            the outreach built from it all live. Setting one up takes about a minute.
          </p>
        </div>
        <Button type="button" size="lg" onClick={onCreate}>
          <PlusIcon />
          New workspace
        </Button>
        <ol className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
          <li>01 Name it</li>
          <li aria-hidden>·</li>
          <li>02 Connect a domain</li>
          <li aria-hidden>·</li>
          <li>03 Review the profile</li>
        </ol>
      </div>
    </div>
  );
}
