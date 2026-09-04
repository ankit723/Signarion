import OpenAI from 'openai';
import { ICP_JSON_SCHEMA } from './icpJsonSchema.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

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
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
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

  // Strict JSON schema guarantees this returns parseable JSON adhering 100% to ICP_JSON_SCHEMA
  return JSON.parse(response.choices[0].message.content);
}