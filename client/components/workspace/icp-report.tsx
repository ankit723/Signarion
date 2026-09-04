"use client";

import type { LucideIcon } from "lucide-react";
import {
  BanknoteIcon,
  Building2Icon,
  CheckIcon,
  CrosshairIcon,
  GaugeIcon,
  LayersIcon,
  LightbulbIcon,
  MapPinIcon,
  PaletteIcon,
  RadarIcon,
  SendIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  TypeIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { brandVars, safeColor, safeImageUrl } from "@/lib/brand";
import { ArcField } from "@/components/arc-field";
import { Badge } from "@/components/ui/badge";
import type { Icp, IcpBrandIdentity, IcpPersona } from "@/types/workspace";

/* ------------------------------------------------------------------ */
/* small building blocks                                                */
/* ------------------------------------------------------------------ */

const nonEmpty = (v?: string[] | null): string[] => (v ?? []).filter((s) => s && s.trim());

// Accent + tint that fall back to the app's primary when the workspace has no
// brand colour (the vars come from `brandVars` on the report root).
const ACCENT = "var(--ws-accent, var(--primary))";
const TINT = "var(--ws-tint, color-mix(in oklab, var(--primary), transparent 88%))";

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  index = 0,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <section
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none"
      style={{ "--tw-animation-delay": `${Math.min(index, 6) * 60}ms` } as React.CSSProperties}
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: TINT, color: ACCENT }}
        >
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl bg-card p-5 ring-1 ring-foreground/10", className)}
      {...props}
    />
  );
}

function Pills({
  items,
  tone = "default",
}: {
  items?: string[] | null;
  tone?: "default" | "primary" | "muted" | "destructive";
}) {
  const list = nonEmpty(items);
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((item) => (
        <span
          key={item}
          className={cn(
            "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
            tone === "default" && "bg-muted text-foreground ring-transparent",
            tone === "primary" && "bg-primary/10 text-foreground ring-primary/20",
            tone === "muted" && "bg-transparent text-muted-foreground ring-border",
            tone === "destructive" && "bg-destructive/10 text-destructive ring-destructive/20"
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="space-y-1">
      <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm text-pretty">{value}</p>
    </div>
  );
}

function ListBlock({
  label,
  items,
  icon: Icon,
  tone,
}: {
  label: string;
  items?: string[] | null;
  icon?: LucideIcon;
  tone?: "default" | "destructive";
}) {
  const list = nonEmpty(items);
  if (list.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">{label}</p>
      <ul className="space-y-1.5">
        {list.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-pretty">
            {Icon ? (
              <Icon
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  tone === "destructive" ? "text-destructive" : "text-primary"
                )}
              />
            ) : (
              <span
                className={cn(
                  "mt-1.5 size-1 shrink-0 rounded-full",
                  tone === "destructive" ? "bg-destructive" : "bg-muted-foreground/60"
                )}
              />
            )}
            <span className={cn(tone === "destructive" && "text-muted-foreground")}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

export function IcpReport({ icp }: { icp: Icp }) {
  const co = icp.company_overview ?? {};
  const fm = icp.target_market_firmographics ?? {};
  const personas = (icp.buyer_personas ?? []).filter(Boolean);
  const sig = icp.technical_and_buying_signals ?? {};
  const out = icp.outreach_strategy ?? {};
  const custom = (icp.custom_ai_insights ?? []).filter((c) => c && (c.category_name || c.key_takeaway));
  const geo = fm.target_geographies ?? {};
  const pricing = co.pricing_model_insights ?? {};
  const brand = icp.brand_identity ?? {};

  const stats = [
    { label: "Target industries", value: nonEmpty(fm.primary_industries).length, icon: TargetIcon },
    { label: "Buyer personas", value: personas.length, icon: UsersIcon },
    { label: "Buying triggers", value: nonEmpty(sig.intent_and_buying_triggers).length, icon: RadarIcon },
    { label: "Outreach angles", value: nonEmpty(out.core_hook_ideas).length, icon: LightbulbIcon },
  ].filter((s) => s.value > 0);

  let idx = 0;

  return (
    <div className="space-y-9" style={brandVars({ icp })}>
      {/* Hero */}
      <div className="dark relative overflow-hidden rounded-2xl bg-background p-6 text-foreground ring-1 ring-foreground/10 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(120%_90%_at_15%_0%,color-mix(in_oklch,var(--primary),transparent_80%),transparent_55%)]" />
        <ArcField
          className="pointer-events-none absolute -right-16 -top-10 size-72"
          style={{ color: "var(--ws-accent, var(--primary))", opacity: 0.22 }}
        />
        <div className="relative space-y-4">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <SparklesIcon className="size-3.5 text-primary" />
            Ideal customer profile
          </p>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {co.company_name || "Customer intelligence"}
            </h1>
            {co.tagline ? <p className="text-sm text-muted-foreground">{co.tagline}</p> : null}
          </div>
          {co.one_sentence_summary ? (
            <p className="max-w-2xl text-pretty sm:text-lg">{co.one_sentence_summary}</p>
          ) : null}
          {co.business_model ? (
            <Badge variant="secondary" className="font-mono tracking-wide uppercase">
              {co.business_model}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Stat row */}
      {stats.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <s.icon className="size-4 text-primary" />
              <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Brand & design */}
      {(nonEmpty([
        brand.primary_color,
        brand.accent_color,
        brand.secondary_color,
        brand.background_color,
        brand.text_color,
      ] as string[]).length > 0 ||
        brand.favicon_url ||
        brand.theme ||
        nonEmpty(brand.design_style).length > 0 ||
        brand.typography) ? (
        <Section
          icon={PaletteIcon}
          title="Brand & design"
          subtitle="How the site looks — this themes the workspace"
          index={idx++}
        >
          <BrandPanel brand={brand} />
        </Section>
      ) : null}

      {/* Offering */}
      {(co.detailed_value_proposition ||
        nonEmpty(co.primary_products_services).length > 0 ||
        nonEmpty(co.core_differentiators).length > 0 ||
        pricing.estimated_acv ||
        nonEmpty(pricing.pricing_tiers_found).length > 0 ||
        pricing.pricing_notes) ? (
        <Section icon={Building2Icon} title="The offering" subtitle="What this company sells and why it wins" index={idx++}>
          <Panel className="space-y-5">
            <Field label="Value proposition" value={co.detailed_value_proposition} />
            {nonEmpty(co.primary_products_services).length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Products &amp; services
                </p>
                <Pills items={co.primary_products_services} />
              </div>
            ) : null}
            <ListBlock label="Core differentiators" items={co.core_differentiators} icon={CheckIcon} />

            {(pricing.estimated_acv ||
              nonEmpty(pricing.pricing_tiers_found).length > 0 ||
              pricing.pricing_notes ||
              typeof pricing.free_trial_or_freemium === "boolean") ? (
              <div className="space-y-3 rounded-lg bg-muted/60 p-4">
                <p className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  <BanknoteIcon className="size-3.5" />
                  Pricing
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  {pricing.estimated_acv ? (
                    <span>
                      <span className="text-muted-foreground">Est. ACV </span>
                      <span className="font-medium">{pricing.estimated_acv}</span>
                    </span>
                  ) : null}
                  {typeof pricing.free_trial_or_freemium === "boolean" ? (
                    <span>
                      <span className="text-muted-foreground">Free tier </span>
                      <span className="font-medium">{pricing.free_trial_or_freemium ? "Yes" : "No"}</span>
                    </span>
                  ) : null}
                </div>
                <Pills items={pricing.pricing_tiers_found} tone="muted" />
                {pricing.pricing_notes ? (
                  <p className="text-sm text-muted-foreground text-pretty">{pricing.pricing_notes}</p>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </Section>
      ) : null}

      {/* Target market */}
      {(nonEmpty(fm.primary_industries).length > 0 ||
        nonEmpty(fm.secondary_industries).length > 0 ||
        nonEmpty(fm.niche_sub_segments).length > 0 ||
        nonEmpty(fm.company_size_headcount).length > 0 ||
        nonEmpty(fm.target_revenue_ranges).length > 0 ||
        nonEmpty(fm.funding_stage_preference).length > 0 ||
        nonEmpty(geo.primary_regions).length > 0 ||
        nonEmpty(geo.target_countries).length > 0) ? (
        <Section icon={TargetIcon} title="Target market" subtitle="Firmographics that define a good-fit account" index={idx++}>
          <div className="grid gap-3 md:grid-cols-2">
            {nonEmpty(fm.primary_industries).length > 0 ? (
              <Panel className="md:col-span-2 space-y-2">
                <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Primary industries
                </p>
                <Pills items={fm.primary_industries} tone="primary" />
              </Panel>
            ) : null}
            {nonEmpty(fm.secondary_industries).length > 0 ? (
              <Panel className="space-y-2">
                <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Secondary industries
                </p>
                <Pills items={fm.secondary_industries} />
              </Panel>
            ) : null}
            {nonEmpty(fm.niche_sub_segments).length > 0 ? (
              <Panel className="space-y-2">
                <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Niche sub-segments
                </p>
                <Pills items={fm.niche_sub_segments} />
              </Panel>
            ) : null}
            {nonEmpty(fm.company_size_headcount).length > 0 ? (
              <Panel className="space-y-2">
                <p className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  <UsersIcon className="size-3.5" /> Company size
                </p>
                <Pills items={fm.company_size_headcount} tone="muted" />
              </Panel>
            ) : null}
            {nonEmpty(fm.target_revenue_ranges).length > 0 ? (
              <Panel className="space-y-2">
                <p className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  <TrendingUpIcon className="size-3.5" /> Revenue
                </p>
                <Pills items={fm.target_revenue_ranges} tone="muted" />
              </Panel>
            ) : null}
            {nonEmpty(fm.funding_stage_preference).length > 0 ? (
              <Panel className="space-y-2">
                <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Funding stage
                </p>
                <Pills items={fm.funding_stage_preference} tone="muted" />
              </Panel>
            ) : null}
            {(nonEmpty(geo.primary_regions).length > 0 ||
              nonEmpty(geo.target_countries).length > 0 ||
              nonEmpty(geo.excluded_regions).length > 0) ? (
              <Panel className="md:col-span-2 space-y-3">
                <p className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  <MapPinIcon className="size-3.5" /> Geography
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {nonEmpty(geo.primary_regions).length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Primary regions</p>
                      <Pills items={geo.primary_regions} />
                    </div>
                  ) : null}
                  {nonEmpty(geo.target_countries).length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Countries</p>
                      <Pills items={geo.target_countries} />
                    </div>
                  ) : null}
                  {nonEmpty(geo.excluded_regions).length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Excluded</p>
                      <Pills items={geo.excluded_regions} tone="destructive" />
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* Personas */}
      {personas.length > 0 ? (
        <Section icon={UsersIcon} title="Buyer personas" subtitle="Who to reach inside a target account" index={idx++}>
          <div className="grid gap-3 lg:grid-cols-2">
            {personas.map((p, i) => (
              <PersonaCard key={`${p.persona_type ?? "persona"}-${i}`} persona={p} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* Signals */}
      {(nonEmpty(sig.intent_and_buying_triggers).length > 0 ||
        nonEmpty(sig.technographics_required).length > 0 ||
        nonEmpty(sig.technographics_complementary).length > 0 ||
        nonEmpty(sig.disqualifiers).length > 0) ? (
        <Section icon={RadarIcon} title="Signals & technographics" subtitle="What makes an account timely — or a poor fit" index={idx++}>
          <div className="grid gap-3 md:grid-cols-2">
            {nonEmpty(sig.intent_and_buying_triggers).length > 0 ? (
              <Panel className="md:col-span-2 border-l-2 border-primary/40">
                <ListBlock label="Buying triggers" items={sig.intent_and_buying_triggers} icon={RadarIcon} />
              </Panel>
            ) : null}
            {nonEmpty(sig.technographics_required).length > 0 ? (
              <Panel className="space-y-2">
                <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Required tech
                </p>
                <Pills items={sig.technographics_required} tone="primary" />
              </Panel>
            ) : null}
            {nonEmpty(sig.technographics_complementary).length > 0 ? (
              <Panel className="space-y-2">
                <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Complementary tech
                </p>
                <Pills items={sig.technographics_complementary} tone="muted" />
              </Panel>
            ) : null}
            {nonEmpty(sig.disqualifiers).length > 0 ? (
              <Panel className="md:col-span-2">
                <ListBlock label="Disqualifiers" items={sig.disqualifiers} icon={ShieldAlertIcon} tone="destructive" />
              </Panel>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* Outreach */}
      {(nonEmpty(out.recommended_channels).length > 0 ||
        nonEmpty(out.core_hook_ideas).length > 0 ||
        nonEmpty(out.spam_safe_value_angles).length > 0) ? (
        <Section icon={SendIcon} title="Outreach strategy" subtitle="How to open the conversation" index={idx++}>
          <Panel className="space-y-5">
            {nonEmpty(out.recommended_channels).length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Recommended channels
                </p>
                <Pills items={out.recommended_channels} />
              </div>
            ) : null}
            <ListBlock label="Hook ideas" items={out.core_hook_ideas} icon={LightbulbIcon} />
            <ListBlock label="Spam-safe value angles" items={out.spam_safe_value_angles} icon={CheckIcon} />
          </Panel>
        </Section>
      ) : null}

      {/* Custom insights */}
      {custom.length > 0 ? (
        <Section icon={GaugeIcon} title="Custom insights" subtitle="Model-generated angles specific to this company" index={idx++}>
          <div className="grid gap-3 md:grid-cols-2">
            {custom.map((c, i) => (
              <Panel key={`${c.category_name ?? "insight"}-${i}`} className="space-y-2">
                <p className="flex items-center gap-2 font-heading text-sm font-medium">
                  <LayersIcon className="size-3.5 text-primary" />
                  {c.category_name || "Insight"}
                </p>
                {c.key_takeaway ? <p className="text-sm text-pretty">{c.key_takeaway}</p> : null}
                <ListBlock label="" items={c.supporting_details} />
              </Panel>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function BrandPanel({ brand }: { brand: IcpBrandIdentity }) {
  const favicon = safeImageUrl(brand.favicon_url);
  const swatches = (
    [
      ["Primary", brand.primary_color],
      ["Accent", brand.accent_color],
      ["Secondary", brand.secondary_color],
      ["Background", brand.background_color],
      ["Text", brand.text_color],
    ] as const
  )
    .map(([name, raw]) => ({ name, color: safeColor(raw), raw }))
    .filter((s) => s.color);

  return (
    <Panel className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={favicon}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-lg bg-muted object-contain p-1 ring-1 ring-foreground/10"
          />
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs">
          {brand.theme ? (
            <Badge variant="secondary" className="font-mono uppercase tracking-wide">
              {brand.theme}
            </Badge>
          ) : null}
          {brand.typography ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
              <TypeIcon className="size-3" />
              {brand.typography}
            </span>
          ) : null}
        </div>
      </div>

      {swatches.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {swatches.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span
                className="size-8 rounded-lg ring-1 ring-foreground/15"
                style={{ backgroundColor: s.color as string }}
              />
              <div className="leading-tight">
                <p className="text-xs font-medium">{s.name}</p>
                <p className="font-mono text-[0.7rem] text-muted-foreground">{s.raw}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {nonEmpty(brand.design_style).length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {nonEmpty(brand.design_style).map((d) => (
            <span
              key={d}
              className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/20"
            >
              {d}
            </span>
          ))}
        </div>
      ) : null}

      {brand.logo_description ? (
        <p className="text-sm text-muted-foreground text-pretty">{brand.logo_description}</p>
      ) : null}
    </Panel>
  );
}

function PersonaCard({ persona }: { persona: IcpPersona }) {
  const meta = [...nonEmpty(persona.departments), ...nonEmpty(persona.seniority_levels)];
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <CrosshairIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold tracking-tight">
            {persona.persona_type || "Buyer persona"}
          </p>
          {meta.length > 0 ? (
            <p className="text-xs text-muted-foreground">{meta.join(" · ")}</p>
          ) : null}
        </div>
      </div>

      <Pills items={persona.job_titles} tone="muted" />

      <div className="grid gap-4 sm:grid-cols-2">
        <ListBlock label="Pain points" items={persona.primary_pain_points} />
        <ListBlock label="Desired outcomes" items={persona.key_desired_outcomes} icon={CheckIcon} />
      </div>

      {nonEmpty(persona.common_objections).length > 0 ? (
        <ListBlock label="Objections" items={persona.common_objections} tone="destructive" />
      ) : null}
      {nonEmpty(persona.kpis_they_care_about).length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            KPIs they own
          </p>
          <Pills items={persona.kpis_they_care_about} tone="muted" />
        </div>
      ) : null}
    </div>
  );
}
