import "./setup"
import { describe, expect, test } from "bun:test"
import { tryWithFallback, isRetryableError } from "@/lib/fallback"

describe("isRetryableError", () => {
  test("non-retryable: unauthorized", () => {
    expect(isRetryableError(new Error("Unauthorized request"))).toBe(false)
  })

  test("non-retryable: invalid request", () => {
    expect(isRetryableError(new Error("Invalid request"))).toBe(false)
  })

  test("non-retryable: context length exceeded", () => {
    expect(isRetryableError(new Error("Context length exceeded"))).toBe(false)
  })

  test("retryable: rate limit", () => {
    expect(isRetryableError(new Error("Rate limit exceeded"))).toBe(true)
  })

  test("retryable: 503", () => {
    expect(isRetryableError(new Error("Service returned 503"))).toBe(true)
  })

  test("retryable: timeout", () => {
    expect(isRetryableError(new Error("Request timed out"))).toBe(true)
  })
})

describe("tryWithFallback", () => {
  test("returns first successful attempt", async () => {
    const r = await tryWithFallback(
      ["a", "b", "c"],
      async (alias) => `got-${alias}`,
    )
    expect(r.result).toBe("got-a")
    expect(r.modelAlias).toBe("a")
    expect(r.attemptIndex).toBe(0)
    expect(r.fallbackAttempts.length).toBe(0)
  })

  test("falls through to next model on retryable error", async () => {
    let callCount = 0
    const r = await tryWithFallback(
      ["a", "b"],
      async (alias) => {
        callCount++
        if (alias === "a") throw new Error("503 service unavailable")
        return "ok"
      },
    )
    expect(r.result).toBe("ok")
    expect(r.modelAlias).toBe("b")
    expect(callCount).toBe(2)
    expect(r.fallbackAttempts.length).toBe(1)
  })

  test("stops at non-retryable error on a single model — moves to next", async () => {
    // Non-retryable breaks inner retry loop; we still try the next model in the chain.
    const r = await tryWithFallback(
      ["a", "b"],
      async (alias) => {
        if (alias === "a") throw new Error("Unauthorized")
        return "fallback-ok"
      },
    )
    expect(r.result).toBe("fallback-ok")
    expect(r.modelAlias).toBe("b")
  })

  test("rethrows when all models fail", async () => {
    await expect(
      tryWithFallback(
        ["a", "b"],
        async () => { throw new Error("503 upstream") },
      ),
    ).rejects.toThrow("503")
  })

  test("rejects empty chain", async () => {
    await expect(tryWithFallback([], async () => "never")).rejects.toThrow(
      /at least one/i,
    )
  })
})
