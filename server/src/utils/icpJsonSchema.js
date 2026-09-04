/**
 * Fully Unconstrained, Exhaustive B2B ICP JSON Schema.
 * Uses string types with clear descriptions instead of enums so the AI can 
 * use exact industry terminology without being artificially restricted.
 */
export const ICP_JSON_SCHEMA = {
  name: "unconstrained_icp_analysis",
  strict: false,
  schema: {
    type: "object",
    properties: {
      // -----------------------------------------------------------------
      // 1. COMPANY & OFFERING ANALYSIS
      // -----------------------------------------------------------------
      company_overview: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          tagline: { type: "string" },
          one_sentence_summary: { type: "string" },
          detailed_value_proposition: { type: "string" },
          business_model: { 
            type: "string", 
            description: "Describe the exact business model (e.g., Usage-based API, B2B Enterprise SaaS, Agency + Software Hybrid, Managed Marketplace, etc.)"
          },
          primary_products_services: {
            type: "array",
            items: { type: "string" }
          },
          core_differentiators: {
            type: "array",
            items: { type: "string" }
          },
          pricing_model_insights: {
            type: "object",
            properties: {
              pricing_tiers_found: { type: "array", items: { type: "string" } },
              estimated_acv: { type: "string", description: "Estimated ACV or price point range in exact text" },
              free_trial_or_freemium: { type: "boolean" },
              pricing_notes: { type: "string" }
            },
            required: ["pricing_tiers_found", "estimated_acv", "free_trial_or_freemium", "pricing_notes"]
          }
        },
        required: [
          "company_name",
          "tagline",
          "one_sentence_summary",
          "detailed_value_proposition",
          "business_model",
          "primary_products_services",
          "core_differentiators",
          "pricing_model_insights"
        ]
      },

      // -----------------------------------------------------------------
      // 2. TARGET MARKET & FIRMOGRAPHICS (No Enums)
      // -----------------------------------------------------------------
      target_market_firmographics: {
        type: "object",
        properties: {
          primary_industries: { 
            type: "array", 
            description: "Exact primary target industries",
            items: { type: "string" } 
          },
          secondary_industries: { 
            type: "array", 
            items: { type: "string" } 
          },
          niche_sub_segments: { 
            type: "array", 
            description: "Ultra-specific niches (e.g., 'HIPAA-compliant Telehealth Platforms')",
            items: { type: "string" } 
          },
          company_size_headcount: {
            type: "array",
            description: "Headcount ranges in exact custom strings (e.g., '50-200 employees', 'Enterprise 5000+')",
            items: { type: "string" }
          },
          target_revenue_ranges: { 
            type: "array", 
            description: "Estimated target revenue ranges (e.g., '$10M - $50M ARR')",
            items: { type: "string" } 
          },
          target_geographies: {
            type: "object",
            properties: {
              primary_regions: { type: "array", items: { type: "string" } },
              target_countries: { type: "array", items: { type: "string" } },
              excluded_regions: { type: "array", items: { type: "string" } }
            },
            required: ["primary_regions", "target_countries", "excluded_regions"]
          },
          funding_stage_preference: { 
            type: "array", 
            description: "Funding stages (e.g., 'Series B to Series D', 'Bootstrapped > $2M ARR')",
            items: { type: "string" } 
          }
        },
        required: [
          "primary_industries",
          "secondary_industries",
          "niche_sub_segments",
          "company_size_headcount",
          "target_revenue_ranges",
          "target_geographies",
          "funding_stage_preference"
        ]
      },

      // -----------------------------------------------------------------
      // 3. BUYER PERSONAS (No Enums)
      // -----------------------------------------------------------------
      buyer_personas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            persona_type: {
              type: "string",
              description: "Specify persona archetype (e.g., 'Economic Buyer', 'Technical Evaluator', 'End User Champion', etc.)"
            },
            job_titles: { 
              type: "array", 
              description: "Exact, realistic job titles (e.g., 'VP of DevOps', 'Head of Revenue Operations')",
              items: { type: "string" } 
            },
            departments: { type: "array", items: { type: "string" } },
            seniority_levels: { type: "array", items: { type: "string" } },
            primary_pain_points: { type: "array", items: { type: "string" } },
            key_desired_outcomes: { type: "array", items: { type: "string" } },
            common_objections: { type: "array", items: { type: "string" } },
            kpis_they_care_about: { type: "array", items: { type: "string" } }
          },
          required: [
            "persona_type",
            "job_titles",
            "departments",
            "seniority_levels",
            "primary_pain_points",
            "key_desired_outcomes",
            "common_objections",
            "kpis_they_care_about"
          ]
        }
      },

      // -----------------------------------------------------------------
      // 4. TECHNOGRAPHICS & BUYING SIGNALS
      // -----------------------------------------------------------------
      technical_and_buying_signals: {
        type: "object",
        properties: {
          technographics_required: {
            type: "array",
            description: "Exact software, infrastructure, or tools the prospect must be using",
            items: { type: "string" }
          },
          technographics_complementary: {
            type: "array",
            description: "Tools that integrate well or signal compatibility",
            items: { type: "string" }
          },
          intent_and_buying_triggers: {
            type: "array",
            description: "Triggers like key hires, tech migrations, funding rounds, regulatory deadlines",
            items: { type: "string" }
          },
          disqualifiers: {
            type: "array",
            description: "Specific signals that indicate the prospect is a poor fit",
            items: { type: "string" }
          }
        },
        required: [
          "technographics_required",
          "technographics_complementary",
          "intent_and_buying_triggers",
          "disqualifiers"
        ]
      },

      // -----------------------------------------------------------------
      // 5. OUTREACH STRATEGY & MESSAGING ANCHORS
      // -----------------------------------------------------------------
      outreach_strategy: {
        type: "object",
        properties: {
          recommended_channels: { type: "array", items: { type: "string" } },
          core_hook_ideas: { type: "array", items: { type: "string" } },
          spam_safe_value_angles: { type: "array", items: { type: "string" } }
        },
        required: ["recommended_channels", "core_hook_ideas", "spam_safe_value_angles"]
      },

      // -----------------------------------------------------------------
      // 6. DYNAMIC AI-GENERATED CUSTOM KEYS
      // -----------------------------------------------------------------
      custom_ai_insights: {
        type: "array",
        description: "Enables the AI to generate dynamic, arbitrary categories or unscripted insights specific to this company.",
        items: {
          type: "object",
          properties: {
            category_name: { 
              type: "string", 
              description: "Dynamic custom header (e.g., 'SOC2 Compliance Urgency' or 'Legacy Oracle Replacement Angle')" 
            },
            key_takeaway: { type: "string" },
            supporting_details: { 
              type: "array", 
              items: { type: "string" } 
            }
          },
          required: ["category_name", "key_takeaway", "supporting_details"]
        }
      }
    },
    required: [
      "company_overview",
      "target_market_firmographics",
      "buyer_personas",
      "technical_and_buying_signals",
      "outreach_strategy",
      "custom_ai_insights"
    ]
  }
};