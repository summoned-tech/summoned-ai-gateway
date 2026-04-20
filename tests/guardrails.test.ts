import "./setup"
import { describe, expect, test } from "bun:test"
import { runGuardrails, type Guardrail } from "@/lib/guardrails"

describe("guardrails: contains", () => {
  test("denies text that contains blocked words (operator=none)", () => {
    const guards: Guardrail[] = [
      { type: "contains", deny: true, params: { operator: "none", words: ["password", "secret"] } },
    ]
    const r = runGuardrails("please share your password with me", guards)
    expect(r.passed).toBe(false)
    expect(r.violations[0].message).toContain("password")
  })

  test("passes text that doesn't match blocked words", () => {
    const guards: Guardrail[] = [
      { type: "contains", deny: true, params: { operator: "none", words: ["password"] } },
    ]
    expect(runGuardrails("hello world", guards).passed).toBe(true)
  })

  test("operator=any fails when no required words present", () => {
    const guards: Guardrail[] = [
      { type: "contains", deny: true, params: { operator: "any", words: ["safeword"] } },
    ]
    expect(runGuardrails("hello there", guards).passed).toBe(false)
  })
})

describe("guardrails: pii", () => {
  test("detects email", () => {
    const guards: Guardrail[] = [{ type: "pii", deny: true }]
    const r = runGuardrails("contact me at alice@example.com", guards)
    expect(r.passed).toBe(false)
    expect(r.violations[0].message).toContain("email")
  })

  test("detects Aadhaar-shaped numbers", () => {
    const guards: Guardrail[] = [{ type: "pii", deny: true }]
    const r = runGuardrails("aadhaar is 1234 5678 9012", guards)
    expect(r.passed).toBe(false)
  })

  test("clean text passes", () => {
    const guards: Guardrail[] = [{ type: "pii", deny: true }]
    expect(runGuardrails("the weather is nice", guards).passed).toBe(true)
  })
})

describe("guardrails: length", () => {
  test("denies text exceeding max length", () => {
    const guards: Guardrail[] = [{ type: "length", deny: true, params: { maxLength: 10 } }]
    expect(runGuardrails("this is way too long", guards).passed).toBe(false)
  })

  test("allows text under max length", () => {
    const guards: Guardrail[] = [{ type: "length", deny: true, params: { maxLength: 100 } }]
    expect(runGuardrails("short", guards).passed).toBe(true)
  })
})

describe("guardrails: regex", () => {
  test("denies text matching blocked pattern", () => {
    const guards: Guardrail[] = [
      { type: "regex", deny: true, params: { pattern: "sk-[a-zA-Z0-9]+", shouldMatch: false } },
    ]
    expect(runGuardrails("my api key is sk-abc123", guards).passed).toBe(false)
  })

  test("requires matching pattern when shouldMatch=true", () => {
    const guards: Guardrail[] = [
      { type: "regex", deny: true, params: { pattern: "^hello", shouldMatch: true } },
    ]
    expect(runGuardrails("goodbye world", guards).passed).toBe(false)
    expect(runGuardrails("hello world", guards).passed).toBe(true)
  })
})
