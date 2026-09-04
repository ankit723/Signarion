/**
 * Workspace + ICP shapes. Mirrors server/src/models/workspace.model.js and the
 * ICP schema in server/src/utils/icpJsonSchema.js. Every ICP field is optional —
 * the model defaults `icp` to `{}` and the generator can return partial data.
 */

export type WorkspaceRole = "owner" | "member";

export interface WorkspaceMember {
  uid: string;
  email: string | null;
  displayName: string;
  role: WorkspaceRole;
}

/** Minimal owner identity, attached to workspaces the current user is a member of. */
export interface WorkspaceOwnerInfo {
  email: string | null;
  displayName: string;
}

export type IcpJobStatus = "idle" | "queued" | "running" | "ready" | "failed";

export interface IcpJob {
  status: IcpJobStatus;
  domain?: string | null;
  stage?: string | null;
  /** The generated ICP awaiting review — only present when status is "ready". */
  draft?: Icp | null;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface Workspace {
  _id: string;
  name: string;
  owner: string;
  members: string[];
  trackedDomain?: string | null;
  connectedEmails?: string[];
  connectedLinkedin?: string | null;
  icp?: Icp | null;
  icpJob?: IcpJob | null;
  createdAt?: string;
  updatedAt?: string;
  /** Present when `role === "member"` — who owns this workspace. */
  ownerInfo?: WorkspaceOwnerInfo | null;
  /** Added client-side from which bucket the API returned it in. */
  role: WorkspaceRole;
  /** Resolved member list — only present after a details / member call. */
  resolvedMembers?: WorkspaceMember[];
}

export interface IcpPricingInsights {
  pricing_tiers_found?: string[];
  estimated_acv?: string;
  free_trial_or_freemium?: boolean;
  pricing_notes?: string;
}

export interface IcpCompanyOverview {
  company_name?: string;
  tagline?: string;
  one_sentence_summary?: string;
  detailed_value_proposition?: string;
  business_model?: string;
  primary_products_services?: string[];
  core_differentiators?: string[];
  pricing_model_insights?: IcpPricingInsights;
}

export interface IcpGeographies {
  primary_regions?: string[];
  target_countries?: string[];
  excluded_regions?: string[];
}

export interface IcpFirmographics {
  primary_industries?: string[];
  secondary_industries?: string[];
  niche_sub_segments?: string[];
  company_size_headcount?: string[];
  target_revenue_ranges?: string[];
  target_geographies?: IcpGeographies;
  funding_stage_preference?: string[];
}

export interface IcpPersona {
  persona_type?: string;
  job_titles?: string[];
  departments?: string[];
  seniority_levels?: string[];
  primary_pain_points?: string[];
  key_desired_outcomes?: string[];
  common_objections?: string[];
  kpis_they_care_about?: string[];
}

export interface IcpBuyingSignals {
  technographics_required?: string[];
  technographics_complementary?: string[];
  intent_and_buying_triggers?: string[];
  disqualifiers?: string[];
}

export interface IcpOutreachStrategy {
  recommended_channels?: string[];
  core_hook_ideas?: string[];
  spam_safe_value_angles?: string[];
}

export interface IcpCustomInsight {
  category_name?: string;
  key_takeaway?: string;
  supporting_details?: string[];
}

export interface IcpBrandIdentity {
  favicon_url?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  theme?: string;
  design_style?: string[];
  typography?: string;
  logo_description?: string;
}

export interface Icp {
  company_overview?: IcpCompanyOverview;
  target_market_firmographics?: IcpFirmographics;
  buyer_personas?: IcpPersona[];
  technical_and_buying_signals?: IcpBuyingSignals;
  outreach_strategy?: IcpOutreachStrategy;
  custom_ai_insights?: IcpCustomInsight[];
  brand_identity?: IcpBrandIdentity;
}

/** `true` when the workspace has a generated ICP worth rendering. */
export function hasIcp(workspace: Pick<Workspace, "icp">): boolean {
  const icp = workspace.icp;
  return Boolean(icp && typeof icp === "object" && Object.keys(icp).length > 0);
}
