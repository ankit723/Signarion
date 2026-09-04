"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CircleAlertIcon, RotateCcwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AnalysisPhase = "running" | "done" | "error";

const STAGES = [
  { label: "Connecting to domain", hint: "Resolving DNS and opening a secure session" },
  { label: "Analyzing website structure", hint: "Mapping pages, navigation and sitemaps" },
  { label: "Understanding business context", hint: "Reading positioning, offering and pricing" },
  { label: "Extracting relevant signals", hint: "Personas, industries, tech and buying triggers" },
  { label: "Preparing workspace intelligence", hint: "Assembling the ideal-customer profile" },
] as const;

const STAGE_MS = 2600;

interface Props {
  domain: string;
  phase: AnalysisPhase;
  errorMessage?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function DomainAnalysisLoader({ domain, phase, errorMessage, onRetry, onDismiss }: Props) {
  // Auto-advance through the stages while running, but never past the last one —
  // the final stage stays "active" until the real request resolves. The parent
  // keys this component per run, so `stage` starts fresh at 0 each time.
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, STAGE_MS);
    return () => clearInterval(id);
  }, [phase]);

  const activeStage = phase === "done" ? STAGES.length : stage;
  const isError = phase === "error";

  return (
    <div className="grid gap-6">
      <style>{loaderCss}</style>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl px-6 pb-6 pt-8",
          "dark bg-background text-foreground ring-1 ring-foreground/10"
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(120%_80%_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_82%),transparent_60%)]" />

        <div className="relative flex flex-col items-center gap-5">
          <Constellation phase={phase} activeStage={activeStage} />

          <div className="min-h-11 text-center">
            {isError ? (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-destructive">
                <CircleAlertIcon className="size-4" />
                Analysis failed
              </p>
            ) : phase === "done" ? (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
                <CheckIcon className="size-4" />
                Workspace intelligence ready
              </p>
            ) : (
              <p key={stage} className="dal-fade text-sm font-medium">
                {STAGES[stage].label}
                <span className="dal-dots" aria-hidden />
              </p>
            )}
            <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
              {domain}
            </p>
          </div>
        </div>
      </div>

      <ol className="grid gap-1">
        {STAGES.map((s, i) => {
          const state = isError && i === stage ? "error" : i < activeStage ? "done" : i === activeStage ? "active" : "pending";
          return (
            <li
              key={s.label}
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2 transition-colors",
                state === "active" && "bg-muted",
                state === "error" && "bg-destructive/10"
              )}
            >
              <StageMark state={state} index={i} />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    state === "pending" && "text-muted-foreground/70",
                    state === "error" && "text-destructive"
                  )}
                >
                  {s.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {state === "done" ? "Done" : state === "error" ? errorMessage ?? "Something went wrong" : s.hint}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {isError ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onDismiss ? (
            <Button type="button" variant="ghost" onClick={onDismiss}>
              Close
            </Button>
          ) : null}
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              <RotateCcwIcon />
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StageMark({ state, index }: { state: string; index: number }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-3" />
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
        <CircleAlertIcon className="size-3" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-primary/40">
        <span className="dal-ping size-2 rounded-full bg-primary" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-border">
      <span className="font-mono text-[0.65rem] text-muted-foreground/70">{index + 1}</span>
    </span>
  );
}

function Constellation({ phase, activeStage }: { phase: AnalysisPhase; activeStage: number }) {
  const nodes = [-90, -30, 30, 90, 150].map((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    return { x: 100 + Math.cos(rad) * 66, y: 100 + Math.sin(rad) * 66, on: i < activeStage || phase === "done" };
  });

  return (
    <svg viewBox="0 0 200 200" className="size-40" role="img" aria-label="Analyzing domain">
      <defs>
        <radialGradient id="dal-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.15" />
        </radialGradient>
      </defs>

      {phase === "running" ? (
        <g className="dal-spin" style={{ transformOrigin: "100px 100px" }}>
          <path d="M100 100 L100 18 A82 82 0 0 1 168 60 Z" fill="var(--primary)" opacity="0.10" />
        </g>
      ) : null}

      {nodes.map((n, i) => (
        <line
          key={`l-${i}`}
          x1="100"
          y1="100"
          x2={n.x}
          y2={n.y}
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeOpacity={n.on ? 0.55 : 0.15}
          strokeDasharray="3 5"
          className={phase === "running" ? "dal-flow" : undefined}
        />
      ))}

      {nodes.map((n, i) => (
        <g key={`n-${i}`}>
          {n.on && phase === "running" ? (
            <circle cx={n.x} cy={n.y} r="8" fill="var(--primary)" opacity="0.25" className="dal-pulse" />
          ) : null}
          <circle
            cx={n.x}
            cy={n.y}
            r="4.5"
            fill={n.on ? "var(--primary)" : "var(--muted-foreground)"}
            fillOpacity={n.on ? 1 : 0.4}
          />
        </g>
      ))}

      <circle cx="100" cy="100" r="26" fill="url(#dal-core)" className={phase === "running" ? "dal-breathe" : undefined} />
      <circle cx="100" cy="100" r="12" fill="var(--primary)" />
      <circle cx="100" cy="100" r="12" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.5" className={phase === "running" ? "dal-halo" : undefined} />
    </svg>
  );
}

const loaderCss = `
.dal-fade { animation: dal-fade .4s ease-out both; }
@keyframes dal-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: no-preference) {
  .dal-fade { animation: dal-fade-move .45s ease-out both; }
  @keyframes dal-fade-move { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
}
.dal-dots::after { content: "…"; display: inline-block; width: 1ch; margin-left: 1px; }
@media (prefers-reduced-motion: no-preference) {
  .dal-dots::after { animation: dal-dots 1.4s steps(4,end) infinite; }
  @keyframes dal-dots { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
  .dal-spin { animation: dal-spin 4s linear infinite; }
  .dal-flow { animation: dal-flow 1s linear infinite; }
  .dal-pulse { animation: dal-pulse 1.8s ease-out infinite; }
  .dal-breathe { animation: dal-breathe 3s ease-in-out infinite; }
  .dal-halo { animation: dal-halo 2s ease-out infinite; }
  .dal-ping { animation: dal-ping 1.4s cubic-bezier(0,0,0.2,1) infinite; }
}
@keyframes dal-spin { to { transform: rotate(360deg); } }
@keyframes dal-flow { to { stroke-dashoffset: -8; } }
@keyframes dal-pulse { 0% { transform: scale(0.6); opacity: 0.5; } 100% { transform: scale(1.8); opacity: 0; } }
@keyframes dal-breathe { 0%,100% { opacity: 0.7; transform: scale(1); transform-box: fill-box; transform-origin: center; } 50% { opacity: 1; transform: scale(1.08); } }
@keyframes dal-halo { 0% { transform: scale(1); opacity: 0.6; transform-box: fill-box; transform-origin: center; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes dal-ping { 0% { transform: scale(0.7); opacity: 0.8; } 80%,100% { transform: scale(1.9); opacity: 0; } }
`;
