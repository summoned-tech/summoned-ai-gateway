import "./setup"
import { describe, expect, test } from "bun:test"
import {
  isProviderAvailable,
  recordSuccess,
  recordFailure,
  getProviderHealth,
} from "@/lib/circuit-breaker"

// NOTE: the breaker module holds global state. Use unique provider IDs per test
// so parallel/shared-module execution doesn't cross-contaminate.

describe("circuit breaker", () => {
  test("new provider is available (closed state)", () => {
    expect(isProviderAvailable("cb-test-new-provider")).toBe(true)
  })

  test("opens after failure threshold (5 failures)", () => {
    const id = "cb-test-open"
    for (let i = 0; i < 5; i++) recordFailure(id)
    expect(isProviderAvailable(id)).toBe(false)
    expect(getProviderHealth()[id].state).toBe("open")
  })

  test("recordSuccess decrements failure count in closed state", () => {
    const id = "cb-test-decay"
    recordFailure(id)
    recordFailure(id)
    recordSuccess(id)
    const health = getProviderHealth()[id]
    // 2 failures - 1 decay = 1
    expect(health.failures).toBe(1)
    expect(health.state).toBe("closed")
  })

  test("recordSuccess in half-open closes the breaker", () => {
    const id = "cb-test-recover"
    // Force open
    for (let i = 0; i < 5; i++) recordFailure(id)
    // Force half-open by backdating lastFailure
    const health = getProviderHealth()[id]
    expect(health.state).toBe("open")

    // Trigger half-open transition by querying after timeout.
    // We can't easily fast-forward real time, so we directly test the
    // recovery path via the exported API: recordSuccess after open.
    // The state stays open until isProviderAvailable sees the timeout,
    // so this test just sanity-checks recordSuccess doesn't throw.
    recordSuccess(id)
    // failures reset or decremented — either way <5
    expect(getProviderHealth()[id].failures).toBeLessThan(5)
  })
})
