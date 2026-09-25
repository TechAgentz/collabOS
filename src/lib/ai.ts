import OpenAI from "openai";
import type { Deal, DealPriority } from "@/lib/types";

// LLM provider: Groq, serving open-weight models through an OpenAI-compatible
// API — so the `openai` npm package (MIT) is only used as the HTTP client.
//
// Override without code changes:
//   AI_MODEL     e.g. "openai/gpt-oss-120b" (Apache-2.0 weights) on Groq
//   AI_BASE_URL  e.g. "http://localhost:11434/v1" to run fully local on Ollama
//                (Ollama ignores the key, but GROQ_API_KEY must be non-empty)
const BASE_URL = process.env.AI_BASE_URL || "https://api.groq.com/openai/v1";
const MODEL = process.env.AI_MODEL || "llama-3.3-70b-versatile";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    // Throwing here surfaces as a 502 from the calling route, which is the
    // right signal: misconfiguration, not bad input.
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    client = new OpenAI({ apiKey, baseURL: BASE_URL });
  }
  return client;
}

// ---------------------------------------------------------------------------
// 1. Deal extraction (ingestion pipeline)
// ---------------------------------------------------------------------------

export interface ExtractedDeal {
  is_deal: boolean;
  brand_name: string | null;
  contact_name: string | null;
  budget: number | null;
  currency: string | null;
  deliverables: string[];
  deadline: string | null; // YYYY-MM-DD
  priority: DealPriority;
  summary: string;
}

// JSON mode (json_object) rather than json_schema: it works on every Groq
// model and on Ollama, whereas schema-constrained decoding is limited to a few
// models. The trade-off is that the shape is only requested, not enforced, so
// the prompt spells it out and normaliseDeal() below validates every field.
const EXTRACTION_SYSTEM_PROMPT = `You are the intake engine for CollabOS, a CRM for social media influencers.
You receive one raw inbound message (email, Instagram DM, or WhatsApp message).
Decide whether it is brand-collaboration related and extract structured fields.

Respond with a single JSON object with exactly these keys and nothing else:
{
  "is_deal": boolean,
  "brand_name": string or null,
  "contact_name": string or null,
  "budget": number or null,
  "currency": string or null,
  "deliverables": array of strings,
  "deadline": string or null,
  "priority": "low" | "medium" | "high",
  "summary": string
}

Rules:
- "is_deal": false for spam, fan mail, newsletters, or anything unrelated to brand deals.
- "brand_name": the company or brand pitching. null if not identifiable.
- "budget": total offered amount as a plain number, no symbols or commas. null if not stated.
- "currency": ISO 4217 code (e.g. "USD", "INR") when stated or clearly implied, else null.
- "deliverables": short strings, e.g. ["1x Instagram Reel", "3x Stories"]. Empty list if none stated.
- "deadline": content/delivery deadline as YYYY-MM-DD, resolving relative dates against today's date (provided). null if not stated.
- "priority": "high" for large budgets, tight deadlines, or well-known brands; "medium" for typical pitches; "low" for vague or mass outreach.
- "summary": 1-2 sentences a talent manager would write in a CRM.
Extract only what is in the message. Never invent values.`;

const PRIORITIES: readonly DealPriority[] = ["low", "medium", "high"];

function nullableString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Coerces a loosely-shaped model response into ExtractedDeal, or throws. */
function normaliseDeal(raw: unknown, text: string): ExtractedDeal {
  const d = (raw ?? {}) as Record<string, unknown>;

  const priority = String(d.priority ?? "").toLowerCase() as DealPriority;
  if (typeof d.is_deal !== "boolean" || typeof d.summary !== "string" || !PRIORITIES.includes(priority)) {
    throw new Error(`AI output missing required fields: ${text.slice(0, 200)}`);
  }

  // Models sometimes return "45,000" or "$3,500" despite the prompt.
  let budget: number | null = null;
  if (typeof d.budget === "number" && Number.isFinite(d.budget)) {
    budget = d.budget;
  } else if (typeof d.budget === "string") {
    // Require a digit so "not stated" doesn't become Number("") === 0.
    const digits = d.budget.replace(/[^0-9.]/g, "");
    const n = Number(digits);
    budget = /\d/.test(digits) && Number.isFinite(n) ? n : null;
  }

  const currency = nullableString(d.currency)?.toUpperCase() ?? null;
  const deadline =
    typeof d.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.deadline) ? d.deadline : null;
  const deliverables = Array.isArray(d.deliverables)
    ? d.deliverables.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];

  return {
    is_deal: d.is_deal,
    brand_name: nullableString(d.brand_name),
    contact_name: nullableString(d.contact_name),
    budget,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    deliverables,
    deadline,
    priority,
    summary: d.summary.trim(),
  };
}

export async function extractDealFromMessage(
  rawText: string,
  channel: string,
  sender?: string,
): Promise<ExtractedDeal> {
  const today = new Date().toISOString().slice(0, 10);

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_completion_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Channel: ${channel}\nSender: ${sender ?? "unknown"}\nToday's date: ${today}\n\nMessage:\n"""\n${rawText}\n"""`,
      },
    ],
  });

  const choice = completion.choices[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    throw new Error(`AI returned no extraction text (finish_reason=${choice?.finish_reason ?? "none"})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`AI returned non-JSON output: ${text.slice(0, 200)}`);
  }

  return normaliseDeal(parsed, text);
}

// ---------------------------------------------------------------------------
// 2. Voice briefing (talent-manager-style spoken summary)
// ---------------------------------------------------------------------------

export interface ActivityItem {
  channel: string;
  direction: string;
  sender: string | null;
  text: string;
  at: string;
}

const BRIEFING_SYSTEM_PROMPT = `You are the user's sharp, upbeat talent manager. Your reply is read aloud by text-to-speech, so use plain conversational sentences only — no markdown, bullets, emojis, or headings — and keep it under 120 words.

If the user asked a SPECIFIC QUESTION, answer THAT question directly using the deals and recent activity provided (for example: "the last activity was Priya from GlowCosmetics messaging about the reel", or "you have two deals in negotiating"). Do not fall back to a generic briefing.

If there is no specific question, GREET the user by their first name (when one is provided) and give a short summary: lead with the headline numbers (new/unread pitches and total money on the table), call out any high-priority deal or tight deadline by brand name, and end with one concrete next action. If there are no new pitches, greet them warmly and say they're all caught up.

Only use the data provided. If the answer genuinely isn't in the data, say so in one short sentence.`;

export async function generateVoiceBriefing(
  deals: Deal[],
  userQuery?: string,
  recentActivity?: ActivityItem[],
  userName?: string,
): Promise<string> {
  const dealDigest = deals.map((d) => ({
    brand: d.brand_name,
    budget: d.budget,
    currency: d.currency,
    deliverables: d.deliverables,
    deadline: d.deadline,
    priority: d.priority,
    stage: d.stage,
    channel: d.source_channel,
    is_read: d.is_read,
    summary: d.summary,
  }));

  const question = userQuery?.trim();
  const activityText = recentActivity?.length
    ? `\n\nRecent activity (newest first):\n${JSON.stringify(recentActivity, null, 2)}`
    : "";

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0.6,
    max_completion_tokens: 400,
    messages: [
      { role: "system", content: BRIEFING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${userName ? `The user's first name is "${userName}".\n` : ""}Deals (JSON):\n${JSON.stringify(dealDigest, null, 2)}${activityText}\n\n${
          question ? `The user asked: "${question}"` : "No specific question — greet them by name and give a quick summary of any new pitches."
        }`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error(`AI returned no briefing text (finish_reason=${completion.choices[0]?.finish_reason ?? "none"})`);
  }
  return text;
}
