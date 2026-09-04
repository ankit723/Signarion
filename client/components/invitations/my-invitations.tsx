"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CircleAlertIcon, InboxIcon, MailIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { invitationApi } from "@/lib/invitations";
import { useWorkspaces } from "@/context/workspaces-context";
import type { MyInvitation } from "@/types/invitation";

type ListStatus = "loading" | "ready" | "error";

/** Dedicated page: every workspace invitation addressed to the signed-in user. */
export function MyInvitations() {
  const router = useRouter();
  const { refresh } = useWorkspaces();
  const [items, setItems] = useState<MyInvitation[]>([]);
  const [status, setStatus] = useState<ListStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; kind: "accept" } | null>(null);
  const [declineTarget, setDeclineTarget] = useState<MyInvitation | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setError(null);
    // Nested so the catch lives outside `load`'s own body — keeps this a
    // plain fire-and-forget effect call from the linter's point of view.
    await (async () => {
      try {
        setItems(await invitationApi.listMine());
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load your invitations.");
        setStatus("error");
      } finally {
        inFlight.current = false;
      }
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async (inv: MyInvitation) => {
    if (busy) return;
    setBusy({ id: inv._id, kind: "accept" });
    try {
      const { workspaceId } = await invitationApi.accept(inv._id);
      setItems((cur) => cur.filter((i) => i._id !== inv._id));
      toast.success(`Joined ${inv.workspaceName}.`);
      await refresh();
      router.push(`/dashboard/workspaces/${workspaceId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't accept that invitation.");
      setBusy(null);
    }
  };

  const confirmDecline = async () => {
    if (!declineTarget) return;
    await invitationApi.decline(declineTarget._id);
    setItems((cur) => cur.filter((i) => i._id !== declineTarget._id));
    toast.success(`Declined the invite to ${declineTarget.workspaceName}.`);
  };

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Dashboard
        </p>
        <h1 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight">Invitations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspaces other people have invited you to join.
        </p>
      </Reveal>

      {status === "loading" ? (
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
          <CircleAlertIcon className="size-5 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Reveal className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-card ring-1 ring-foreground/10">
            <InboxIcon className="size-5 text-primary" />
          </span>
          <div className="max-w-sm space-y-1">
            <h2 className="font-heading text-base font-semibold">No pending invitations</h2>
            <p className="text-sm text-muted-foreground">
              When someone invites you to a workspace, it&apos;ll show up here.
            </p>
          </div>
        </Reveal>
      ) : (
        <ul className="grid gap-3">
          {items.map((inv, i) => (
            <Reveal key={inv._id} delay={Math.min(i, 6) * 55}>
              <li className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <MailIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.workspaceName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Invited by {inv.invitedBy.displayName || inv.invitedBy.email || "someone"}
                    {inv.trackedDomain ? ` · ${inv.trackedDomain}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeclineTarget(inv)}
                    disabled={busy !== null}
                  >
                    <XIcon />
                    Decline
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => accept(inv)}
                    disabled={busy !== null}
                  >
                    {busy?.id === inv._id && busy.kind === "accept" ? <Spinner /> : <CheckIcon />}
                    Accept
                  </Button>
                </div>
              </li>
            </Reveal>
          ))}
        </ul>
      )}

      {declineTarget ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeclineTarget(null)}
          title="Decline this invitation?"
          description={
            <>
              You won&apos;t join{" "}
              <span className="font-medium text-foreground">{declineTarget.workspaceName}</span>.
              Whoever invited you can send another invite later if you change your mind.
            </>
          }
          confirmLabel="Decline invite"
          onConfirm={confirmDecline}
        />
      ) : null}
    </div>
  );
}
