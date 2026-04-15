import { env } from "@/lib/env"

export interface CostResult {
  costUsd: number
  costInr: number
  inputCostUsd: number
  outputCostUsd: number
}

/**
 * Per-1M-token pricing. Separate from the provider layer so it
 * can be updated independently (or loaded from a remote API later).
 *
 * Missing entries → zero cost (gateway still works, just no cost tracking).
 * The key format is "provider:model" — e.g. "openai:gpt-4o".
 */
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "openai:gpt-4o":              { input: 2.50, output: 10.00 },
  "openai:gpt-4o-mini":         { input: 0.15, output: 0.60 },
  "openai:gpt-4-turbo":         { input: 10.00, output: 30.00 },
  "openai:o1":                  { input: 15.00, output: 60.00 },
  "openai:o1-mini":             { input: 3.00, output: 12.00 },
  "openai:o3-mini":             { input: 1.10, output: 4.40 },

  // Anthropic
  "anthropic:claude-sonnet-4-20250514":    { input: 3.00, output: 15.00 },
  "anthropic:claude-3-5-sonnet-20241022":  { input: 3.00, output: 15.00 },
  "anthropic:claude-3-5-haiku-20241022":   { input: 0.80, output: 4.00 },
  "anthropic:claude-3-haiku-20240307":     { input: 0.25, output: 1.25 },
  "anthropic:claude-3-opus-20240229":      { input: 15.00, output: 75.00 },

  // Google Gemini
  "google:gemini-2.0-flash":    { input: 0.10, output: 0.40 },
  "google:gemini-1.5-pro":      { input: 1.25, output: 5.00 },
  "google:gemini-1.5-flash":    { input: 0.075, output: 0.30 },

  // Groq (hosted models — significantly cheaper)
  "groq:llama-3.3-70b-versatile":    { input: 0.59, output: 0.79 },
  "groq:llama-3.1-8b-instant":       { input: 0.05, output: 0.08 },
  "groq:mixtral-8x7b-32768":         { input: 0.24, output: 0.24 },

  // AWS Bedrock
  "bedrock:anthropic.claude-sonnet-4-20250514-v1:0":  { input: 3.00, output: 15.00 },
  "bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0": { input: 3.00, output: 15.00 },
  "bedrock:anthropic.claude-3-haiku-20240307-v1:0":   { input: 0.25, output: 1.25 },
  "bedrock:amazon.nova-pro-v1:0":      { input: 0.80, output: 3.20 },
  "bedrock:amazon.nova-lite-v1:0":     { input: 0.06, output: 0.24 },
  "bedrock:amazon.nova-micro-v1:0":    { input: 0.035, output: 0.14 },
}

/**
 * Return the input cost per 1M tokens for a model alias like "openai/gpt-4o".
 * Returns Infinity for unknown models so they sort last in cost routing.
 */
export function getInputCostPer1M(alias: string): number {
  const slash = alias.indexOf("/")
  if (slash === -1) return Infinity
  const providerId = alias.slice(0, slash)
  const modelId = alias.slice(slash + 1)
  return PRICING[`${providerId}:${modelId}`]?.input ?? Infinity
}

export function calculateCost(
  providerId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): CostResult {
  const key = `${providerId}:${modelId}`
  const pricing = PRICING[key]

  if (!pricing) {
    return { costUsd: 0, costInr: 0, inputCostUsd: 0, outputCostUsd: 0 }
  }

  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.output
  const costUsd = inputCostUsd + outputCostUsd
  const costInr = costUsd * env.USD_INR_RATE

  return { costUsd, costInr, inputCostUsd, outputCostUsd }
}
