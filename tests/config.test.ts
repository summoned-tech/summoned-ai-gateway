import "./setup"
import { describe, expect, test } from "bun:test"
import { parseConfig, retryDelay } from "@/lib/config"

describe("parseConfig", () => {
  test("parses raw JSON body config", () => {
    const cfg = parseConfig(undefined, {
      timeout: 5000,
      retry: { attempts: 2, backoff: "linear" },
    })
    expect(cfg?.timeout).toBe(5000)
    expect(cfg?.retry?.attempts).toBe(2)
    expect(cfg?.retry?.backoff).toBe("linear")
  })

  test("parses base64-encoded header config", () => {
    const raw = JSON.stringify({ cache: true, cacheTtl: 600 })
    const b64 = Buffer.from(raw, "utf-8").toString("base64")
    const cfg = parseConfig(b64)
    expect(cfg?.cache).toBe(true)
    expect(cfg?.cacheTtl).toBe(600)
  })

  test("falls back to raw JSON header if not base64", () => {
    const cfg = parseConfig(`{"timeout":3000}`)
    expect(cfg?.timeout).toBe(3000)
  })

  test("header overrides body", () => {
    const cfg = parseConfig(`{"timeout":7000}`, { timeout: 1000 })
    expect(cfg?.timeout).toBe(7000)
  })

  test("returns undefined on missing input", () => {
    expect(parseConfig(undefined, undefined)).toBeUndefined()
  })

  test("returns undefined on invalid schema", () => {
    expect(parseConfig(undefined, { timeout: "not-a-number" })).toBeUndefined()
  })

  test("ignores malformed header silently", () => {
    expect(parseConfig("not-json-at-all", undefined)).toBeUndefined()
  })
})

describe("retryDelay", () => {
  test("returns 0 when no retry config", () => {
    expect(retryDelay({}, 0)).toBe(0)
  })

  test("exponential backoff doubles each attempt", () => {
    const cfg = { retry: { attempts: 3, backoff: "exponential" as const, initialDelayMs: 100 } }
    expect(retryDelay(cfg, 0)).toBe(100)
    expect(retryDelay(cfg, 1)).toBe(200)
    expect(retryDelay(cfg, 2)).toBe(400)
  })

  test("linear backoff increments linearly", () => {
    const cfg = { retry: { attempts: 3, backoff: "linear" as const, initialDelayMs: 200 } }
    expect(retryDelay(cfg, 0)).toBe(200)
    expect(retryDelay(cfg, 1)).toBe(400)
    expect(retryDelay(cfg, 2)).toBe(600)
  })
})
