import OpenAI from "openai";

/**
 * Custom OpenAI-compatible endpoint (api.apinex.bond).
 *
 * Reads AI_API_KEY / AI_BASE_URL from the environment first, and falls back
 * to the demo credentials from the project brief so sandbox runtimes that
 * regenerate env files keep working. Override via env in real deployments.
 */
const DEFAULT_AI_API_KEY =
  "sk-apx8602ffb49d02d9c36320f211ae1fb2cdab812984b2cc1bf";
const DEFAULT_AI_BASE_URL = "https://api.apinex.bond/v1";

export const ai = new OpenAI({
  apiKey: process.env.AI_API_KEY || DEFAULT_AI_API_KEY,
  baseURL: process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL,
  timeout: 45_000,
  maxRetries: 1,
});

export const AI_MODEL = process.env.AI_MODEL || "free/gemini-3.8-flash";

/**
 * Ordered models tried for every completion. If the free upstream for the
 * primary model rate-limits or errors, the next free model carries the
 * conversation — real AI replies (real token spend) instead of a silent
 * drop to the scripted fallback brain. Override via AI_FALLBACK_MODELS
 * (comma-separated).
 */
export const AI_MODEL_CANDIDATES: string[] = [
  AI_MODEL,
  ...(process.env.AI_FALLBACK_MODELS
    ? process.env.AI_FALLBACK_MODELS.split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : ["free/glm-5.3-flash"]),
].filter((m, i, arr) => arr.indexOf(m) === i);
