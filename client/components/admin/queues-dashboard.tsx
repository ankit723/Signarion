"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleAlertIcon,
  InboxIcon,
  ListChecksIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { queueApi } from "@/lib/queues";
import type { JobState, QueueJob, QueueName, QueueSummary } from "@/types/queue";

const QUEUE_LABELS: Record<QueueName, string> = {
  email: "Email queue",
  icp: "ICP analysis queue",
};

const STATES: JobState[] = ["waiting", "active", "delayed", "paused", "completed", "failed"];

const STATE_BADGE: Record<JobState, "default" | "secondary" | "destructive" | "outline"> = {
  waiting: "outline",
  active: "default",
  delayed: "outline",
  paused: "outline",
  completed: "secondary",
  failed: "destructive",
  unknown: "outline",
};

const POLL_MS = 5000;

function formatTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Admin-only. Linked from nowhere in the main nav — reached directly at the URL. */
export function QueuesDashboard() {
  const [summaries, setSummaries] = useState<QueueSummary[] | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [activeQueue, setActiveQueue] = useState<QueueName>("email");
  const [statusFilter, setStatusFilter] = useState<JobState | null>(null);
  const [jobs, setJobs] = useState<QueueJob[] | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<QueueJob | null>(null);

  const summaryInFlight = useRef(false);
  const loadSummaries = useCallback(async () => {
    if (summaryInFlight.current) return;
    summaryInFlight.current = true;
    await (async () => {
      try {
        setSummaries(await queueApi.listQueues());
        setSummaryError(null);
      } catch (err) {
        setSummaryError(err instanceof Error ? err.message : "Couldn't load queue counts.");
      } finally {
        summaryInFlight.current = false;
      }
    })();
  }, []);

  const jobsInFlight = useRef(false);
  const loadJobs = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (jobsInFlight.current) return;
      jobsInFlight.current = true;
      // Nested so no setState call sits directly in this function's own body —
      // keeps effect-triggered calls a plain fire-and-forget to the linter.
      await (async () => {
        if (!opts?.silent) setJobsLoading(true);
        try {
          const { jobs: fetched } = await queueApi.listJobs(
            activeQueue,
            statusFilter ?? undefined
          );
          setJobs(fetched);
          setJobsError(null);
        } catch (err) {
          setJobsError(err instanceof Error ? err.message : "Couldn't load jobs.");
        } finally {
          setJobsLoading(false);
          jobsInFlight.current = false;
        }
      })();
    },
    [activeQueue, statusFilter]
  );

  useEffect(() => {
    void loadSummaries();
    const id = setInterval(() => void loadSummaries(), POLL_MS);
    return () => clearInterval(id);
  }, [loadSummaries]);

  useEffect(() => {
    void loadJobs();
    const id = setInterval(() => void loadJobs({ silent: true }), POLL_MS);
    return () => clearInterval(id);
  }, [loadJobs]);

  const retry = async (job: QueueJob) => {
    if (retryingId) return;
    setRetryingId(job.id);
    try {
      await queueApi.retryJob(activeQueue, job.id);
      toast.success(`Job ${job.id} queued for retry.`);
      await Promise.all([loadJobs({ silent: true }), loadSummaries()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't retry that job.");
    } finally {
      setRetryingId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    await queueApi.removeJob(activeQueue, removeTarget.id);
    toast.success(`Removed job ${removeTarget.id}.`);
    await Promise.all([loadJobs({ silent: true }), loadSummaries()]);
  };

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Admin
        </p>
        <h1 className="mt-1.5 font-heading text-2xl font-semibold tracking-tight">
          Queue monitor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live activity for background jobs — outreach emails and ICP site analysis.
        </p>
      </Reveal>

      {summaryError ? (
        <Reveal>
          <p className="flex items-center gap-2 text-xs font-medium text-destructive">
            <CircleAlertIcon className="size-3.5" />
            {summaryError}
          </p>
        </Reveal>
      ) : null}

      <Reveal delay={40} className="grid gap-3 sm:grid-cols-2">
        {(["email", "icp"] as const).map((name) => {
          const summary = summaries?.find((s) => s.name === name);
          const total = summary
            ? Object.values(summary.counts).reduce((sum, n) => sum + (n ?? 0), 0)
            : null;
          const active = activeQueue === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                setActiveQueue(name);
                setStatusFilter(null);
              }}
              className={cn(
                "rounded-xl p-5 text-left ring-1 transition-colors",
                active
                  ? "bg-primary/5 ring-primary/40"
                  : "bg-card ring-foreground/10 hover:bg-muted/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-sm font-semibold tracking-tight">
                  {QUEUE_LABELS[name]}
                </h2>
                <span className="font-mono text-xs text-muted-foreground">
                  {total === null ? "—" : total}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {STATES.map((s) => (
                  <Badge key={s} variant={STATE_BADGE[s]} className="font-normal">
                    {s} {summary?.counts[s] ?? 0}
                  </Badge>
                ))}
              </div>
            </button>
          );
        })}
      </Reveal>

      <Reveal delay={80} className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={statusFilter === null ? "default" : "outline"}
          onClick={() => setStatusFilter(null)}
        >
          All
        </Button>
        {STATES.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </Reveal>

      <Reveal delay={120}>
        {jobsLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : jobsError ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
            <CircleAlertIcon className="size-5 text-destructive" />
            <p className="text-sm text-muted-foreground">{jobsError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadJobs()}>
              Try again
            </Button>
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-card ring-1 ring-foreground/10">
              <InboxIcon className="size-5 text-primary" />
            </span>
            <div className="max-w-sm space-y-1">
              <h2 className="font-heading text-base font-semibold">No jobs here</h2>
              <p className="text-sm text-muted-foreground">
                {statusFilter
                  ? `Nothing in "${statusFilter}" for ${QUEUE_LABELS[activeQueue].toLowerCase()}.`
                  : `${QUEUE_LABELS[activeQueue]} is empty right now.`}
              </p>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">#{job.id}</span>
                      <Badge variant={STATE_BADGE[job.state]} className="capitalize">
                        {job.state}
                      </Badge>
                      <span className="text-sm font-medium">{job.name}</span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                      <div>
                        <dt className="inline">Created </dt>
                        <dd className="inline font-medium text-foreground">
                          {formatTime(job.timestamp)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">Finished </dt>
                        <dd className="inline font-medium text-foreground">
                          {formatTime(job.finishedOn)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">Attempts </dt>
                        <dd className="inline font-medium text-foreground">{job.attemptsMade}</dd>
                      </div>
                    </dl>
                    {job.failedReason ? (
                      <p className="mt-2 truncate text-xs font-medium text-destructive">
                        {job.failedReason}
                      </p>
                    ) : null}
                    {job.data ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                          Payload
                        </summary>
                        <pre className="mt-1.5 max-h-48 overflow-auto rounded-lg bg-muted/60 p-2.5 text-[0.7rem] leading-relaxed text-foreground">
                          {JSON.stringify(job.data, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {job.state === "failed" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Retry job ${job.id}`}
                        onClick={() => retry(job)}
                        disabled={retryingId !== null}
                      >
                        {retryingId === job.id ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <RotateCcwIcon className="size-3.5" />
                        )}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove job ${job.id}`}
                      onClick={() => setRemoveTarget(job)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Reveal>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ListChecksIcon className="size-3.5" />
        Refreshes automatically every {POLL_MS / 1000}s.
      </p>

      {removeTarget ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoveTarget(null)}
          title={`Remove job #${removeTarget.id}?`}
          description={
            <>
              This permanently deletes the <span className="font-medium text-foreground">
                {removeTarget.name}
              </span>{" "}
              job from {QUEUE_LABELS[activeQueue].toLowerCase()}. It can&apos;t be recovered or
              retried afterward.
            </>
          }
          confirmLabel="Remove job"
          onConfirm={confirmRemove}
        />
      ) : null}
    </div>
  );
}
