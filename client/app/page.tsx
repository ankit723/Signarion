"use client";

import { ArrowRightIcon, BellRingIcon, RadarIcon, WorkflowIcon } from "lucide-react";

import { ArcField } from "@/components/arc-field";
import { Brand, BRAND_NAME } from "@/components/brand";
import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/auth-context";
import { ROUTES } from "@/lib/auth";

const STEPS = [
  {
    k: "01",
    title: "Connect your signals",
    body: "Hiring, tech-stack, funding and product-usage feeds attach to every account you track.",
  },
  {
    k: "02",
    title: "Watch intent build",
    body: "Each account gets one timeline. The thresholds you set decide what counts as ready.",
  },
  {
    k: "03",
    title: "Reach out in context",
    body: "Sequences pull in the triggering signal, so the first line is never a cold open.",
  },
];

const CAPABILITIES = [
  {
    icon: RadarIcon,
    title: "Signal capture",
    body: "Hiring, tech, funding and usage data on one intent timeline per account.",
  },
  {
    icon: WorkflowIcon,
    title: "Adaptive sequences",
    body: "Messaging reshapes itself around the freshest signal, not a static list.",
  },
  {
    icon: BellRingIcon,
    title: "Real-time alerts",
    body: "Get pinged the moment an account crosses the threshold you defined.",
  },
];

const TIMELINE = [
  { tag: "Hiring", t: "09:14", label: "Posted 12 roles on the data team", live: true },
  { tag: "Tech", t: "08:02", label: "Added Snowflake + dbt to the stack" },
  { tag: "Funding", t: "Yesterday", label: "Closed a $40M Series B" },
  { tag: "Usage", t: "2d ago", label: "Weekly active seats up 38%" },
];

const SIGNAL_TYPES = ["Hiring", "Tech-stack", "Funding", "Product usage", "News mentions"];

function Cta() {
  const { status } = useAuth();

  if (status === "loading") {
    return <Spinner className="size-5 text-muted-foreground" />;
  }
  if (status === "authenticated") {
    return (
      <LinkButton href={ROUTES.dashboard} size="lg" className="h-11 px-5">
        Go to your dashboard
        <ArrowRightIcon />
      </LinkButton>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <LinkButton href={ROUTES.register} size="lg" className="h-11 px-5">
        Get started free
        <ArrowRightIcon />
      </LinkButton>
      <LinkButton href={ROUTES.login} size="lg" variant="outline" className="h-11 px-5">
        Sign in
      </LinkButton>
    </div>
  );
}

/** Mono section label: number + title on a hairline. */
function SectionHead({ index, title, sub }: { index: string; title: string; sub?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-sm text-muted-foreground">{index}</span>
        <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {sub ? <p className="max-w-xl text-sm text-muted-foreground text-pretty">{sub}</p> : null}
      <div className="h-px bg-border" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero — dark-scoped band so every token flips to its dark value */}
        <section className="dark relative overflow-hidden bg-background text-foreground">
          <ArcField className="pointer-events-none absolute -top-16 -right-24 size-136 text-primary/15 sm:-right-8" />
          <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
            <Reveal className="relative" y={16}>
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Signal-based outreach
              </p>
              <h1 className="mt-5 font-heading text-4xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-[3.4rem]">
                Reach the right people before your competitors know they&apos;re looking.
              </h1>
              <p className="mt-6 max-w-md text-muted-foreground text-pretty sm:text-lg">
                Signarion turns raw buying signals into prioritised, context-aware outreach
                — so every conversation starts at peak intent.
              </p>
              <div className="mt-8">
                <Cta />
              </div>
              <p className="mt-6 font-mono text-xs tracking-widest text-muted-foreground uppercase">
                No card required · 2-minute setup
              </p>
            </Reveal>

            <Reveal delay={90} y={16} className="relative">
              <div className="overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <p className="font-heading text-sm font-medium">Northwind Labs</p>
                  <Badge variant="secondary" className="font-mono tracking-widest uppercase">
                    Intent timeline
                  </Badge>
                </div>
                <div className="divide-y divide-border">
                  {TIMELINE.map(({ tag, t, label, live }, i) => (
                    <Reveal
                      key={label}
                      delay={160 + i * 70}
                      y={8}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <span className="relative mt-1.5 flex size-1.5 shrink-0">
                        {live ? (
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70 motion-reduce:hidden" />
                        ) : null}
                        <span
                          className={`relative inline-flex size-1.5 rounded-full ${
                            live ? "bg-primary" : "bg-muted-foreground/60"
                          }`}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground">{label}</p>
                        <p className="mt-0.5 font-mono text-xs tracking-wide text-muted-foreground uppercase">
                          {tag} · {t}
                        </p>
                      </div>
                    </Reveal>
                  ))}
                </div>
                <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-3">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                    Threshold reached — queued for outreach
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 01 — How it works */}
        <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
          <Reveal>
            <SectionHead
              index="01"
              title="How it works"
              sub="Three moves from a cold account list to a warm, timed first touch."
            />
          </Reveal>
          <ol className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-3">
            {STEPS.map(({ k, title, body }, i) => (
              <Reveal key={k} delay={i * 70} className="relative flex flex-col gap-3" y={14}>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-sm text-primary ring-1 ring-primary/25">
                    {k}
                  </span>
                  <span
                    aria-hidden
                    className="hidden h-px flex-1 bg-border sm:block sm:last:hidden"
                  />
                </div>
                <h3 className="font-heading text-base font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground text-pretty">{body}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* 02 — What you get */}
        <section className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
            <Reveal>
              <SectionHead
                index="02"
                title="What you get"
                sub="One timeline per account, sequences that follow it, and an alert the moment intent peaks."
              />
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {CAPABILITIES.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 70} y={14}>
                  <div className="flex h-full flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <h3 className="font-heading text-base font-medium">{title}</h3>
                    <p className="text-sm text-muted-foreground text-pretty">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Signal types strip */}
        <section className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 sm:flex-row sm:items-center sm:justify-between">
            <Reveal>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                One timeline. Every signal.
              </h2>
            </Reveal>
            <Reveal delay={80} className="flex flex-wrap gap-2">
              {SIGNAL_TYPES.map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs tracking-wide text-muted-foreground uppercase"
                >
                  {s}
                </span>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Closing CTA — dark bookend */}
        <section className="dark relative overflow-hidden border-t border-border bg-background text-foreground">
          <ArcField className="pointer-events-none absolute -bottom-32 -left-24 size-120 rotate-180 text-primary/15" />
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-20 sm:flex-row sm:items-center sm:justify-between">
            <Reveal className="space-y-2">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Start where your buyers already are.
              </h2>
              <p className="text-sm text-muted-foreground text-pretty">
                Free to try. Bring one account list and watch the timeline fill in.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <Cta />
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            © {new Date().getFullYear()} {BRAND_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}
