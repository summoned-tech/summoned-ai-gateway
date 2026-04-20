import "./setup"
import { describe, expect, test } from "bun:test"
import { parseModelSlug } from "@/providers/base"

describe("parseModelSlug", () => {
  test("parses provider/model format", () => {
    const r = parseModelSlug("openai/gpt-4o")
    expect(r.provider).toBe("openai")
    expect(r.model).toBe("gpt-4o")
  })

  test("preserves model IDs containing slashes", () => {
    const r = parseModelSlug("bedrock/anthropic.claude-sonnet-4-20250514-v1:0")
    expect(r.provider).toBe("bedrock")
    expect(r.model).toBe("anthropic.claude-sonnet-4-20250514-v1:0")
  })

  test("treats bare model (no slash) as provider-less", () => {
    const r = parseModelSlug("gpt-4o")
    expect(r.provider).toBeUndefined()
    expect(r.model).toBe("gpt-4o")
  })

  test("handles multi-slash model IDs by splitting at first slash only", () => {
    const r = parseModelSlug("meta/llama/3.3-70b")
    expect(r.provider).toBe("meta")
    expect(r.model).toBe("llama/3.3-70b")
  })
})
