/**
 * Runtime detection + abstraction.
 *
 * The gateway runs on both Bun (primary — `bun run dev`, container image)
 * and Node 18+ (for `npx @summoned/gateway` distribution). The two runtimes
 * need slightly different adapters for:
 *
 *   - HTTP server bootstrap  (Bun.serve          vs @hono/node-server)
 *   - Static file serving    (hono/bun           vs @hono/node-server/serve-static)
 *   - WebSocket upgrade      (Bun.serve websocket vs @hono/node-ws)
 *
 * Everything else (routers, middleware, providers, AI SDK calls) is
 * portable and untouched.
 */

// Presence of globalThis.Bun is the canonical Bun detection.
// Ref: https://bun.sh/docs/runtime/bun-apis
export const isBun = typeof (globalThis as any).Bun !== "undefined"
export const runtimeName = isBun ? "bun" : "node"
