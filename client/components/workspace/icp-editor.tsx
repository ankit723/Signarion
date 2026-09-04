"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckIcon, CircleAlertIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { safeColor } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Icp,
  IcpBrandIdentity,
  IcpCompanyOverview,
  IcpCustomInsight,
  IcpFirmographics,
  IcpGeographies,
  IcpPersona,
  IcpPricingInsights,
} from "@/types/workspace";

/* ------------------------------------------------------------------ */
/* draft state                                                          */
/* ------------------------------------------------------------------ */

const pretty = (v: unknown) => JSON.stringify(v ?? {}, null, 2);
const clone = (v: Icp): Icp =>
  typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v ?? {}));

interface Draft {
  /** The structured ICP — always a valid object. Used by the form and by Save. */
  value: Icp;
  setValue: (next: Icp) => void;
  mode: "form" | "json";
  switchMode: (next: "form" | "json") => void;
  jsonText: string;
  setJsonText: (text: string) => void;
  jsonError: string | null;
  dirty: boolean;
  /** `true` when Save should be blocked (JSON tab has an unparseable buffer). */
  blocked: boolean;
}

/**
 * Editor state for an ICP. A structured object is the source of truth; the JSON
 * tab is just a synced text view. Form edits always keep the object valid.
 */
export function useIcpDraft(initial: Icp): Draft {
  const [snapshot] = useState(() => JSON.stringify(initial ?? {}));
  const [value, setValueRaw] = useState<Icp>(() => clone(initial));
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonTextRaw] = useState(() => pretty(initial));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const setValue = useCallback((next: Icp) => setValueRaw(next), []);

  const setJsonText = useCallback((text: string) => {
    setJsonTextRaw(text);
    try {
      const obj = JSON.parse(text) as unknown;
      if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        setJsonError("The top level must be a JSON object ({ … }).");
        return;
      }
      setJsonError(null);
      setValueRaw(obj as Icp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid JSON.";
      setJsonError(msg.replace(/^JSON\.parse:\s*/, ""));
    }
  }, []);

  const switchMode = useCallback(
    (next: "form" | "json") => {
      if (next === "json") {
        setJsonTextRaw(pretty(value));
        setJsonError(null);
      }
      setMode(next);
    },
    [value]
  );

  const dirty = useMemo(() => JSON.stringify(value) !== snapshot, [value, snapshot]);

  return {
    value,
    setValue,
    mode,
    switchMode,
    jsonText,
    setJsonText,
    jsonError,
    dirty,
    blocked: mode === "json" && jsonError !== null,
  };
}

/* ------------------------------------------------------------------ */
/* field primitives                                                     */
/* ------------------------------------------------------------------ */

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Labeled label={label} hint={hint}>
      <Input
        className="h-9"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Labeled>
  );
}

function AreaField({
  label,
  hint,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  hint?: string;
  value?: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <Labeled label={label} hint={hint}>
      <textarea
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
    </Labeled>
  );
}

function ToggleField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-input accent-primary"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Chip / tag input for a list of short phrases. Enter or comma adds; × removes. */
function TagField({
  label,
  hint,
  values,
  onChange,
  placeholder = "Type and press Enter",
}: {
  label: string;
  hint?: string;
  values?: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const list = values ?? [];
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...list];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setText("");
  };

  return (
    <Labeled label={label} hint={hint}>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-transparent p-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        {list.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              aria-label={`Remove ${v}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && text === "" && list.length > 0) {
              onChange(list.slice(0, -1));
            }
          }}
          onBlur={() => text && add(text)}
          placeholder={list.length === 0 ? placeholder : ""}
          className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </Labeled>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const safe = safeColor(value);
  return (
    <Labeled label={label}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-9 shrink-0 rounded-lg border border-input bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[10px_10px]"
        >
          <span
            className="block size-full rounded-[inherit]"
            style={safe ? { backgroundColor: safe } : undefined}
          />
        </span>
        <Input
          className="h-9 font-mono text-xs"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1e40af"
        />
      </div>
    </Labeled>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div>
        <h3 className="font-heading text-sm font-semibold tracking-tight">{title}</h3>
        {desc ? <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* form editor                                                          */
/* ------------------------------------------------------------------ */

function FormEditor({ value, onChange }: { value: Icp; onChange: (v: Icp) => void }) {
  const co = value.company_overview ?? {};
  const fm = value.target_market_firmographics ?? {};
  const geo: IcpGeographies = fm.target_geographies ?? {};
  const pricing: IcpPricingInsights = co.pricing_model_insights ?? {};
  const sig = value.technical_and_buying_signals ?? {};
  const out = value.outreach_strategy ?? {};
  const brand: IcpBrandIdentity = value.brand_identity ?? {};
  const personas = value.buyer_personas ?? [];
  const insights = value.custom_ai_insights ?? [];

  const patchCO = (p: Partial<IcpCompanyOverview>) =>
    onChange({ ...value, company_overview: { ...co, ...p } });
  const patchPricing = (p: Partial<IcpPricingInsights>) =>
    patchCO({ pricing_model_insights: { ...pricing, ...p } });
  const patchFM = (p: Partial<IcpFirmographics>) =>
    onChange({ ...value, target_market_firmographics: { ...fm, ...p } });
  const patchGeo = (p: Partial<IcpGeographies>) =>
    patchFM({ target_geographies: { ...geo, ...p } });
  const patchSig = (p: Partial<typeof sig>) =>
    onChange({ ...value, technical_and_buying_signals: { ...sig, ...p } });
  const patchOut = (p: Partial<typeof out>) =>
    onChange({ ...value, outreach_strategy: { ...out, ...p } });
  const patchBrand = (p: Partial<IcpBrandIdentity>) =>
    onChange({ ...value, brand_identity: { ...brand, ...p } });

  const setPersonas = (next: IcpPersona[]) => onChange({ ...value, buyer_personas: next });
  const patchPersona = (i: number, p: Partial<IcpPersona>) =>
    setPersonas(personas.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setInsights = (next: IcpCustomInsight[]) =>
    onChange({ ...value, custom_ai_insights: next });
  const patchInsight = (i: number, p: Partial<IcpCustomInsight>) =>
    setInsights(insights.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div className="space-y-4">
      <Section title="Company" desc="What this company is and how it wins.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Company name" value={co.company_name} onChange={(v) => patchCO({ company_name: v })} />
          <TextField label="Tagline" value={co.tagline} onChange={(v) => patchCO({ tagline: v })} />
        </div>
        <AreaField
          label="One-sentence summary"
          rows={2}
          value={co.one_sentence_summary}
          onChange={(v) => patchCO({ one_sentence_summary: v })}
        />
        <AreaField
          label="Value proposition"
          rows={4}
          value={co.detailed_value_proposition}
          onChange={(v) => patchCO({ detailed_value_proposition: v })}
        />
        <TextField
          label="Business model"
          hint="e.g. B2B Enterprise SaaS, Usage-based API, Agency + software hybrid"
          value={co.business_model}
          onChange={(v) => patchCO({ business_model: v })}
        />
        <TagField
          label="Products & services"
          values={co.primary_products_services}
          onChange={(v) => patchCO({ primary_products_services: v })}
        />
        <TagField
          label="Core differentiators"
          values={co.core_differentiators}
          onChange={(v) => patchCO({ core_differentiators: v })}
        />

        <div className="space-y-4 rounded-lg bg-muted/50 p-4">
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            Pricing
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Estimated ACV"
              hint="e.g. $12k–$40k / year"
              value={pricing.estimated_acv}
              onChange={(v) => patchPricing({ estimated_acv: v })}
            />
            <div className="flex items-end pb-1">
              <ToggleField
                label="Free trial or freemium"
                value={pricing.free_trial_or_freemium}
                onChange={(v) => patchPricing({ free_trial_or_freemium: v })}
              />
            </div>
          </div>
          <TagField
            label="Pricing tiers"
            values={pricing.pricing_tiers_found}
            onChange={(v) => patchPricing({ pricing_tiers_found: v })}
          />
          <AreaField
            label="Pricing notes"
            rows={2}
            value={pricing.pricing_notes}
            onChange={(v) => patchPricing({ pricing_notes: v })}
          />
        </div>
      </Section>

      <Section title="Target market" desc="Firmographics that describe a good-fit account.">
        <TagField
          label="Primary industries"
          values={fm.primary_industries}
          onChange={(v) => patchFM({ primary_industries: v })}
        />
        <TagField
          label="Secondary industries"
          values={fm.secondary_industries}
          onChange={(v) => patchFM({ secondary_industries: v })}
        />
        <TagField
          label="Niche sub-segments"
          hint="Ultra-specific niches, e.g. HIPAA-compliant telehealth platforms"
          values={fm.niche_sub_segments}
          onChange={(v) => patchFM({ niche_sub_segments: v })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TagField
            label="Company size"
            hint="e.g. 50–200 employees"
            values={fm.company_size_headcount}
            onChange={(v) => patchFM({ company_size_headcount: v })}
          />
          <TagField
            label="Revenue ranges"
            hint="e.g. $10M–$50M ARR"
            values={fm.target_revenue_ranges}
            onChange={(v) => patchFM({ target_revenue_ranges: v })}
          />
        </div>
        <TagField
          label="Funding stage preference"
          values={fm.funding_stage_preference}
          onChange={(v) => patchFM({ funding_stage_preference: v })}
        />
        <div className="space-y-4 rounded-lg bg-muted/50 p-4">
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            Geography
          </p>
          <TagField
            label="Primary regions"
            values={geo.primary_regions}
            onChange={(v) => patchGeo({ primary_regions: v })}
          />
          <TagField
            label="Target countries"
            values={geo.target_countries}
            onChange={(v) => patchGeo({ target_countries: v })}
          />
          <TagField
            label="Excluded regions"
            values={geo.excluded_regions}
            onChange={(v) => patchGeo({ excluded_regions: v })}
          />
        </div>
      </Section>

      <Section title="Buyer personas" desc="Who to reach inside a target account.">
        <div className="space-y-3">
          {personas.map((p, i) => (
            <div key={i} className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Persona {i + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setPersonas(personas.filter((_, j) => j !== i))}
                >
                  <Trash2Icon />
                  Remove
                </Button>
              </div>
              <TextField
                label="Persona type"
                hint="e.g. Economic Buyer, Technical Evaluator, End-user Champion"
                value={p.persona_type}
                onChange={(v) => patchPersona(i, { persona_type: v })}
              />
              <TagField
                label="Job titles"
                values={p.job_titles}
                onChange={(v) => patchPersona(i, { job_titles: v })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TagField
                  label="Departments"
                  values={p.departments}
                  onChange={(v) => patchPersona(i, { departments: v })}
                />
                <TagField
                  label="Seniority levels"
                  values={p.seniority_levels}
                  onChange={(v) => patchPersona(i, { seniority_levels: v })}
                />
              </div>
              <TagField
                label="Pain points"
                values={p.primary_pain_points}
                onChange={(v) => patchPersona(i, { primary_pain_points: v })}
              />
              <TagField
                label="Desired outcomes"
                values={p.key_desired_outcomes}
                onChange={(v) => patchPersona(i, { key_desired_outcomes: v })}
              />
              <TagField
                label="Common objections"
                values={p.common_objections}
                onChange={(v) => patchPersona(i, { common_objections: v })}
              />
              <TagField
                label="KPIs they own"
                values={p.kpis_they_care_about}
                onChange={(v) => patchPersona(i, { kpis_they_care_about: v })}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPersonas([...personas, {}])}
          >
            <PlusIcon />
            Add persona
          </Button>
        </div>
      </Section>

      <Section title="Signals & technographics" desc="What makes an account timely — or a poor fit.">
        <TagField
          label="Required tech"
          values={sig.technographics_required}
          onChange={(v) => patchSig({ technographics_required: v })}
        />
        <TagField
          label="Complementary tech"
          values={sig.technographics_complementary}
          onChange={(v) => patchSig({ technographics_complementary: v })}
        />
        <TagField
          label="Buying triggers"
          hint="Key hires, tech migrations, funding, regulatory deadlines"
          values={sig.intent_and_buying_triggers}
          onChange={(v) => patchSig({ intent_and_buying_triggers: v })}
        />
        <TagField
          label="Disqualifiers"
          values={sig.disqualifiers}
          onChange={(v) => patchSig({ disqualifiers: v })}
        />
      </Section>

      <Section title="Outreach strategy" desc="How to open the conversation.">
        <TagField
          label="Recommended channels"
          values={out.recommended_channels}
          onChange={(v) => patchOut({ recommended_channels: v })}
        />
        <TagField
          label="Hook ideas"
          values={out.core_hook_ideas}
          onChange={(v) => patchOut({ core_hook_ideas: v })}
        />
        <TagField
          label="Spam-safe value angles"
          values={out.spam_safe_value_angles}
          onChange={(v) => patchOut({ spam_safe_value_angles: v })}
        />
      </Section>

      <Section title="Brand & design" desc="The look of the site — used to theme this workspace's cards.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Favicon URL"
            value={brand.favicon_url}
            onChange={(v) => patchBrand({ favicon_url: v })}
            placeholder="https://acme.com/favicon.ico"
          />
          <TextField
            label="Logo URL"
            value={brand.logo_url}
            onChange={(v) => patchBrand({ logo_url: v })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Primary color" value={brand.primary_color} onChange={(v) => patchBrand({ primary_color: v })} />
          <ColorField label="Accent color" value={brand.accent_color} onChange={(v) => patchBrand({ accent_color: v })} />
          <ColorField label="Secondary color" value={brand.secondary_color} onChange={(v) => patchBrand({ secondary_color: v })} />
          <ColorField label="Background color" value={brand.background_color} onChange={(v) => patchBrand({ background_color: v })} />
          <ColorField label="Text color" value={brand.text_color} onChange={(v) => patchBrand({ text_color: v })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Theme"
            hint="e.g. light, dark, light with dark hero"
            value={brand.theme}
            onChange={(v) => patchBrand({ theme: v })}
          />
          <TextField
            label="Typography"
            hint="Primary font family"
            value={brand.typography}
            onChange={(v) => patchBrand({ typography: v })}
          />
        </div>
        <TagField
          label="Design style"
          hint="e.g. minimal, corporate, playful, glassmorphism"
          values={brand.design_style}
          onChange={(v) => patchBrand({ design_style: v })}
        />
        <AreaField
          label="Logo description"
          rows={2}
          value={brand.logo_description}
          onChange={(v) => patchBrand({ logo_description: v })}
        />
      </Section>

      <Section title="Custom insights" desc="Anything specific to this company that doesn't fit above.">
        <div className="space-y-3">
          {insights.map((c, i) => (
            <div key={i} className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  Insight {i + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setInsights(insights.filter((_, j) => j !== i))}
                >
                  <Trash2Icon />
                  Remove
                </Button>
              </div>
              <TextField
                label="Category"
                value={c.category_name}
                onChange={(v) => patchInsight(i, { category_name: v })}
              />
              <AreaField
                label="Key takeaway"
                rows={2}
                value={c.key_takeaway}
                onChange={(v) => patchInsight(i, { key_takeaway: v })}
              />
              <TagField
                label="Supporting details"
                values={c.supporting_details}
                onChange={(v) => patchInsight(i, { supporting_details: v })}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setInsights([...insights, {}])}
          >
            <PlusIcon />
            Add insight
          </Button>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* raw JSON editor                                                      */
/* ------------------------------------------------------------------ */

function JsonEditor({
  text,
  onChange,
  error,
  disabled,
}: {
  text: string;
  onChange: (v: string) => void;
  error: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={Boolean(error)}
        className={cn(
          "block h-[46vh] max-h-112 min-h-56 w-full resize-y rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground",
          "outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
          error ? "border-destructive" : "border-input focus-visible:border-ring"
        )}
      />
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs",
          error ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {error ? (
          <>
            <CircleAlertIcon className="size-3.5 shrink-0" />
            {error}
          </>
        ) : (
          <>
            <CheckIcon className="size-3.5 shrink-0 text-primary" />
            Valid JSON
          </>
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* editor shell (form / JSON toggle)                                    */
/* ------------------------------------------------------------------ */

export function IcpEditor({ draft, disabled }: { draft: Draft; disabled?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
        {(["form", "json"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => draft.switchMode(m)}
            aria-pressed={draft.mode === m}
            className={cn(
              "rounded-[calc(var(--radius)-0.25rem)] px-3 py-1 font-medium transition-colors",
              draft.mode === m
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "form" ? "Guided" : "JSON"}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {draft.mode === "form" ? (
          <FormEditor value={draft.value} onChange={draft.setValue} />
        ) : (
          <JsonEditor
            text={draft.jsonText}
            onChange={draft.setJsonText}
            error={draft.jsonError}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
