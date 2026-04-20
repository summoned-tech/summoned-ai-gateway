import "./setup"
import { describe, expect, test } from "bun:test"
import { calculateCost, getInputCostPer1M } from "@/lib/pricing"

describe("calculateCost", () => {
  test("unknown model flags priceUnknown and zero cost", () => {
    const r = calculateCost("openai", "nonexistent-model-xyz", 1000, 500)
    expect(r.priceUnknown).toBe(true)
    expect(r.costUsd).toBe(0)
    expect(r.costInr).toBe(0)
  })

  test("known model computes non-zero cost in USD and INR", () => {
    const r = calculateCost("openai", "gpt-4o", 1_000_000, 500_000)
    expect(r.priceUnknown).toBe(false)
    expect(r.costUsd).toBeGreaterThan(0)
    expect(r.costInr).toBeCloseTo(r.costUsd * 85, 5)
    expect(r.inputCostUsd + r.outputCostUsd).toBeCloseTo(r.costUsd, 10)
  })

  test("zero tokens produce zero cost but still priceUnknown=false for known model", () => {
    const r = calculateCost("anthropic", "claude-sonnet-4-20250514", 0, 0)
    expect(r.costUsd).toBe(0)
    expect(r.priceUnknown).toBe(false)
  })
})

describe("getInputCostPer1M", () => {
  test("returns positive price for known model alias", () => {
    expect(getInputCostPer1M("openai/gpt-4o")).toBeGreaterThan(0)
  })

  test("returns 0 for unknown model alias", () => {
    expect(getInputCostPer1M("openai/totally-fake-model")).toBe(0)
  })

  test("returns 0 when alias has no provider prefix", () => {
    expect(getInputCostPer1M("gpt-4o")).toBe(0)
  })
})
