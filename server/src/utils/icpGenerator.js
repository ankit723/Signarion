import OpenAI from 'openai';
import { ICP_JSON_SCHEMA } from './icpJsonSchema.js';
import { createLogger } from './logger.js';

const log = createLogger("icpGenerator");

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// Lazy singleton — ESM hoists imports above app.js's dotenv.config(), so the
// key isn't in process.env yet at module-load time. Build the client on first use.
let _openai;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      log.error("OPENAI_API_KEY is not set — ICP generation will fail");
      throw new Error("OPENAI_API_KEY is not configured");
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Bounded so a hung OpenAI call can't pin a worker slot forever.
      timeout: Number(process.env.OPENAI_TIMEOUT_MS) || 120_000,
      maxRetries: Number(process.env.OPENAI_MAX_RETRIES) || 2,
    });
    log.info("OpenAI client initialised", { model: MODEL });
  }
  return _openai;
}

// System prompt enforcing strict persona logic
const SYSTEM_PROMPT = `
You are a Principal B2B Go-To-Market (GTM) Strategist and Market Intelligence Expert.
Your task is to analyze raw scraped website text and extract an exhaustive Ideal Customer Profile (ICP) and value proposition analysis.

CRITICAL INSTRUCTIONS:
1. Infer details directly from pricing pages, client testimonials, feature descriptions, case studies, and compliance references.
2. Be specific. Avoid vague terms like "Businesses" or "Managers". Use precise designations (e.g., "VP of Product Engineering", "Mid-Market B2B SaaS").
3. Always complete EVERY SINGLE field required by the JSON schema. If an attribute cannot be explicitly found, deduce the logical industry standard based on pricing and offering tiering.
`;

// User prompt container
function getUserPrompt(scrapedContent, websiteUrl) {
  return `
    Target Website: ${websiteUrl}

    Scraped Context:
    \"\"\"
    ${scrapedContent}
    \"\"\"

    Analyze the scraped context above and construct the complete Ideal Customer Profile (ICP) JSON object strictly conforming to the requested schema.
    `;
}

/**
 * Sends scraped site content to OpenAI to get the complete structured ICP dataset
 */
export async function generateICPFromScrapedData(scrapedContent, websiteUrl) {
  const startedAt = Date.now();
  log.info("requesting ICP", {
    websiteUrl,
    model: MODEL,
    contentChars: scrapedContent?.length ?? 0,
  });

  if (!scrapedContent || scrapedContent.trim().length === 0) {
    throw new Error(`No scraped content to analyse for ${websiteUrl}`);
  }

  let response;
  try {
    response = await getOpenAI().chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: getUserPrompt(scrapedContent, websiteUrl) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: ICP_JSON_SCHEMA
      }
    });
  } catch (error) {
    log.error("OpenAI request failed", {
      websiteUrl,
      model: MODEL,
      status: error?.status,
      type: error?.type,
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }

  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    log.error("OpenAI returned no content", {
      websiteUrl,
      finishReason: response?.choices?.[0]?.finish_reason,
    });
    throw new Error("The model returned an empty response");
  }

  try {
    // The strict JSON schema should guarantee parseable output, but a refusal
    // or a truncated response still lands here.
    const icp = JSON.parse(content);
    log.info("ICP parsed", {
      websiteUrl,
      durationMs: Date.now() - startedAt,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    });
    return icp;
  } catch (error) {
    log.error("could not parse the model response as JSON", {
      websiteUrl,
      finishReason: response?.choices?.[0]?.finish_reason,
      preview: String(content).slice(0, 300),
      error,
    });
    throw new Error("The model response could not be parsed");
  }
}