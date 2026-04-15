import { createMiddleware } from "hono/factory"
import { env } from "@/lib/env"
import { timingSafeEqual } from "@/lib/crypto"

/**
 * Security headers — applied to every response.
 *
 * Prevents clickjacking, MIME-sniffing, and XSS for the console SPA.
 * These are low-cost, high-value defences that any security researcher
 * will check first when reviewing a public project.
 */
export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  await next()
  c.res.headers.set("X-Content-Type-Options", "nosniff")
  c.res.headers.set("X-Frame-Options", "DENY")
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  c.res.headers.set("X-XSS-Protection", "0") // Disable legacy XSS auditor; rely on CSP instead
  c.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  // Only set HSTS in production (breaks localhost dev if applied everywhere)
  if (env.NODE_ENV === "production" || env.NODE_ENV === "staging") {
    c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  }
})

/**
 * Request body size limiter — prevents memory exhaustion via huge payloads.
 *
 * Default: 4 MB for API routes.
 * Attackers routinely probe new public APIs with giant bodies to cause OOM crashes.
 */
const MAX_BODY_BYTES = 4 * 1024 * 1024 // 4 MB

export const bodySizeLimitMiddleware = createMiddleware(async (c, next) => {
  const contentLength = c.req.header("content-length")
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return c.json(
      { error: { code: "PAYLOAD_TOO_LARGE", message: `Request body must be under ${MAX_BODY_BYTES / 1024 / 1024}MB` } },
      413,
    )
  }
  await next()
})

/**
 * Metrics endpoint auth — protects /metrics from public exposure.
 *
 * Prometheus metrics expose: provider names, tenant IDs, token volumes,
 * latency distributions, error rates. Not public information.
 *
 * Accepts: x-admin-key header OR ?key= query param (for scraper configs).
 */
export const metricsAuthMiddleware = createMiddleware(async (c, next) => {
  const key = c.req.header("x-admin-key") ?? c.req.query("key") ?? ""
  if (!timingSafeEqual(key, env.ADMIN_API_KEY)) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Metrics require admin authentication" } }, 401)
  }
  await next()
})

/**
 * Admin endpoint rate limiter — prevents brute-force of ADMIN_API_KEY.
 *
 * 20 requests/minute per source IP. Stored in a Map (in-process, not Redis)
 * because we can't use Redis before it's connected, and admin calls are rare.
 */
const adminAttempts = new Map<string, { count: number; windowStart: number }>()
const ADMIN_WINDOW_MS = 60_000
const ADMIN_MAX_ATTEMPTS = 20

export const adminRateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip =
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"

  const now = Date.now()
  const entry = adminAttempts.get(ip)

  if (!entry || now - entry.windowStart > ADMIN_WINDOW_MS) {
    adminAttempts.set(ip, { count: 1, windowStart: now })
  } else {
    entry.count++
    if (entry.count > ADMIN_MAX_ATTEMPTS) {
      return c.json(
        { error: { code: "RATE_LIMITED", message: "Too many admin requests. Try again in 60 seconds." } },
        429,
        { "Retry-After": "60" },
      )
    }
  }

  // Prune old entries every 1000 calls to prevent unbounded memory growth
  if (adminAttempts.size > 1000) {
    for (const [k, v] of adminAttempts) {
      if (now - v.windowStart > ADMIN_WINDOW_MS) adminAttempts.delete(k)
    }
  }

  await next()
})
