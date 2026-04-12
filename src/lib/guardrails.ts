import { z } from "zod"
import { logger } from "@/lib/telemetry"

/**
 * Guardrails — validate LLM inputs and outputs.
 *
 * Inspired by Portkey's guardrails: run checks before sending to the provider
 * (input guardrails) and after receiving the response (output guardrails).
 *
 * Each guardrail is a simple { type, params, deny } object:
 *   - "contains" — deny if text contains any of the specified words
 *   - "regex"    — deny if text matches a regex pattern
 *   - "length"   — deny if response exceeds max character length
 *   - "pii"      — deny if common PII patterns detected (email, phone, SSN)
 */

export const guardrailSchema = z.object({
  type: z.enum(["contains", "regex", "length", "pii"]),
  params: z.record(z.string(), z.any()).optional(),
  deny: z.boolean().default(true),
})

export type Guardrail = z.infer<typeof guardrailSchema>

export const guardrailsConfigSchema = z.object({
  input: z.array(guardrailSchema).optional(),
  output: z.array(guardrailSchema).optional(),
})

export type GuardrailsConfig = z.infer<typeof guardrailsConfigSchema>

export interface GuardrailResult {
  passed: boolean
  violations: { guardrail: string; message: string }[]
}

const PII_PATTERNS = [
  { name: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
  { name: "phone_india", pattern: /\b(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/ },
  { name: "phone_us", pattern: /\b(?:\+1[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/ },
  { name: "aadhaar", pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
  { name: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "credit_card", pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/ },
]

function checkGuardrail(text: string, guard: Guardrail): { passed: boolean; message: string } {
  switch (guard.type) {
    case "contains": {
      const words = (guard.params?.words as string[]) ?? []
      const operator = (guard.params?.operator as string) ?? "none"
      const lower = text.toLowerCase()
      const found = words.filter((w) => lower.includes(w.toLowerCase()))

      if (operator === "none" && found.length > 0) {
        return { passed: false, message: `Contains blocked words: ${found.join(", ")}` }
      }
      if (operator === "any" && found.length === 0) {
        return { passed: false, message: `Must contain at least one of: ${words.join(", ")}` }
      }
      return { passed: true, message: "" }
    }

    case "regex": {
      const pattern = guard.params?.pattern as string
      if (!pattern) return { passed: true, message: "" }
      const match = new RegExp(pattern, "i").test(text)
      const shouldMatch = (guard.params?.shouldMatch as boolean) ?? false
      if (shouldMatch && !match) return { passed: false, message: `Text does not match required pattern` }
      if (!shouldMatch && match) return { passed: false, message: `Text matches blocked pattern` }
      return { passed: true, message: "" }
    }

    case "length": {
      const max = (guard.params?.maxLength as number) ?? 10000
      if (text.length > max) {
        return { passed: false, message: `Text exceeds max length of ${max} characters (got ${text.length})` }
      }
      return { passed: true, message: "" }
    }

    case "pii": {
      const detected: string[] = []
      for (const { name, pattern } of PII_PATTERNS) {
        if (pattern.test(text)) detected.push(name)
      }
      if (detected.length > 0) {
        return { passed: false, message: `PII detected: ${detected.join(", ")}` }
      }
      return { passed: true, message: "" }
    }

    default:
      return { passed: true, message: "" }
  }
}

export function runGuardrails(text: string, guards: Guardrail[]): GuardrailResult {
  const violations: { guardrail: string; message: string }[] = []

  for (const guard of guards) {
    const result = checkGuardrail(text, guard)
    if (!result.passed && guard.deny) {
      violations.push({ guardrail: guard.type, message: result.message })
    }
  }

  if (violations.length > 0) {
    logger.warn({ violations }, "guardrail violations detected")
  }

  return { passed: violations.length === 0, violations }
}
