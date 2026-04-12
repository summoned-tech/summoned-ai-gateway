import { logger } from "@/lib/telemetry"

/**
 * Per-provider circuit breaker.
 * Prevents cascading failures by temporarily disabling a provider
 * after too many consecutive errors.
 *
 * States: CLOSED (normal) -> OPEN (broken) -> HALF_OPEN (testing)
 */

type State = "closed" | "open" | "half_open"

interface BreakerState {
  state: State
  failures: number
  lastFailure: number
  lastSuccess: number
}

const breakers = new Map<string, BreakerState>()

const FAILURE_THRESHOLD = 5
const RECOVERY_TIMEOUT_MS = 30_000
const HALF_OPEN_MAX_TRIES = 2

function getBreaker(providerId: string): BreakerState {
  let b = breakers.get(providerId)
  if (!b) {
    b = { state: "closed", failures: 0, lastFailure: 0, lastSuccess: Date.now() }
    breakers.set(providerId, b)
  }
  return b
}

/**
 * Check if a provider is available (circuit not open).
 * In half-open state, allows limited requests through to test recovery.
 */
export function isProviderAvailable(providerId: string): boolean {
  const b = getBreaker(providerId)

  if (b.state === "closed") return true

  if (b.state === "open") {
    if (Date.now() - b.lastFailure > RECOVERY_TIMEOUT_MS) {
      b.state = "half_open"
      b.failures = 0
      logger.info({ providerId }, "circuit breaker half-open, testing provider")
      return true
    }
    return false
  }

  // half_open — allow limited traffic
  return b.failures < HALF_OPEN_MAX_TRIES
}

export function recordSuccess(providerId: string): void {
  const b = getBreaker(providerId)
  b.lastSuccess = Date.now()

  if (b.state === "half_open") {
    b.state = "closed"
    b.failures = 0
    logger.info({ providerId }, "circuit breaker closed, provider recovered")
  } else {
    b.failures = Math.max(0, b.failures - 1)
  }
}

export function recordFailure(providerId: string): void {
  const b = getBreaker(providerId)
  b.failures++
  b.lastFailure = Date.now()

  if (b.state === "closed" && b.failures >= FAILURE_THRESHOLD) {
    b.state = "open"
    logger.warn({ providerId, failures: b.failures }, "circuit breaker OPEN — provider disabled temporarily")
  } else if (b.state === "half_open" && b.failures >= HALF_OPEN_MAX_TRIES) {
    b.state = "open"
    logger.warn({ providerId }, "circuit breaker re-opened — provider still failing")
  }
}

export function getProviderHealth(): Record<string, { state: State; failures: number; lastSuccess: string }> {
  const result: Record<string, { state: State; failures: number; lastSuccess: string }> = {}
  for (const [id, b] of breakers) {
    result[id] = {
      state: b.state,
      failures: b.failures,
      lastSuccess: new Date(b.lastSuccess).toISOString(),
    }
  }
  return result
}
