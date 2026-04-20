/**
 * Runtime-agnostic static file serving.
 *
 * Bun: uses hono/bun serveStatic (reads via Bun.file — fast).
 * Node: uses @hono/node-server/serve-static (reads via fs).
 *
 * Both export the same { serveStatic } API shape, so we just pick one.
 * Dynamic import so the unused one isn't pulled into the final bundle
 * on the other runtime.
 */
import type { MiddlewareHandler } from "hono"
import { isBun } from "./index.js"

type ServeStaticOpts = { root?: string; path?: string }
type ServeStatic = (opts: ServeStaticOpts) => MiddlewareHandler

let cached: ServeStatic | null = null

export async function getServeStatic(): Promise<ServeStatic> {
  if (cached) return cached
  if (isBun) {
    const mod = await import("hono/bun")
    cached = mod.serveStatic as ServeStatic
  } else {
    const mod = await import("@hono/node-server/serve-static")
    cached = mod.serveStatic as unknown as ServeStatic
  }
  return cached
}
