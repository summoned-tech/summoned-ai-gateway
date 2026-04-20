/**
 * Runtime-agnostic HTTP + WebSocket bootstrap.
 *
 * Exposes a single `startServer({ app, port, onLog, onWsClose })` API that
 * starts the gateway on whichever runtime is present. The `onLog` and
 * `onWsClose` callbacks receive the connected WebSocket client so the caller
 * can track its set for the log broadcaster.
 *
 * Returns an abstract ServerHandle the caller can store for things like
 * graceful shutdown.
 */
import type { Hono } from "hono"
import { isBun } from "./index.js"

export interface WsClient {
  send(data: string): void
}

export interface StartServerOpts {
  app: Hono<any, any, any>
  port: number
  wsPath: string
  /** Called when a client connects — return value not used. */
  onWsOpen: (ws: WsClient) => void
  /** Called when a client disconnects. */
  onWsClose: (ws: WsClient) => void
  /** Called by the upgrade handler to decide if the request is authorised.
   *  Return null to reject (handler emits 401). */
  authorizeUpgrade: (req: Request) => boolean
}

export interface ServerHandle {
  /** Close the server. */
  close(): Promise<void>
  /** The underlying runtime-specific server (for advanced uses). */
  native: unknown
}

export async function startServer(opts: StartServerOpts): Promise<ServerHandle> {
  if (isBun) return startServerBun(opts)
  return startServerNode(opts)
}

// ---------------------------------------------------------------------------
// Bun
// ---------------------------------------------------------------------------

async function startServerBun(opts: StartServerOpts): Promise<ServerHandle> {
  const wsClients = new Set<WsClient>()

  const BunRuntime = (globalThis as any).Bun
  const server = BunRuntime.serve({
    port: opts.port,
    fetch: (req: Request, server: any) => {
      // Route /ws/logs through the upgrade path — everything else goes to Hono.
      const url = new URL(req.url)
      if (url.pathname === opts.wsPath) {
        if (!opts.authorizeUpgrade(req)) {
          return new Response(
            JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Valid admin key required" } }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          )
        }
        const ok = server.upgrade(req)
        return ok ? new Response() : new Response("WS upgrade failed", { status: 500 })
      }
      return opts.app.fetch(req, server)
    },
    websocket: {
      open(ws: any) {
        wsClients.add(ws)
        opts.onWsOpen(ws)
      },
      close(ws: any) {
        wsClients.delete(ws)
        opts.onWsClose(ws)
      },
      message(_ws: any, _msg: any) { /* inbound messages ignored */ },
    },
  })

  // Some existing code references globalThis.__bunServer — keep that alive
  // for backwards compatibility with any hot-reload helpers.
  ;(globalThis as any).__bunServer = server

  return {
    native: server,
    async close() { server.stop() },
  }
}

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

async function startServerNode(opts: StartServerOpts): Promise<ServerHandle> {
  const { serve } = await import("@hono/node-server")
  const { createNodeWebSocketServer } = await loadNodeWs()

  // @hono/node-ws provides an "injectWebSocket" that attaches upgrade handling
  // to the Hono app after `serve()` has created the server. The app defines
  // the /ws/logs route as a normal Hono GET that returns `upgradeWebSocket()`.
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocketServer({ app: opts.app })

  opts.app.get(opts.wsPath, upgradeWebSocket((c: any) => {
    if (!opts.authorizeUpgrade(c.req.raw)) {
      // Returning a rejecting handler here still upgrades, then immediately
      // closes with policy-violation code 1008. That matches how the Bun
      // path behaves when auth fails post-upgrade.
      return {
        onOpen(_evt: any, ws: any) {
          ws.close(1008, "UNAUTHORIZED")
        },
      }
    }
    const wsProxy: WsClient = { send: (data: string) => {} }
    return {
      onOpen(_evt: any, ws: any) {
        wsProxy.send = (data: string) => ws.send(data)
        opts.onWsOpen(wsProxy)
      },
      onClose() {
        opts.onWsClose(wsProxy)
      },
    }
  }))

  const server = serve({ fetch: opts.app.fetch, port: opts.port })
  injectWebSocket(server)

  return {
    native: server,
    async close() { await new Promise<void>((r) => server.close(() => r())) },
  }
}

// @hono/node-ws exposes both createNodeWebSocket (1.x) and the older
// createNodeWebSocketServer alias. Pick whichever the installed version ships.
async function loadNodeWs(): Promise<{
  createNodeWebSocketServer: (opts: { app: Hono<any, any, any> }) => {
    injectWebSocket: (server: unknown) => void
    upgradeWebSocket: (fn: any) => any
  }
}> {
  const mod: any = await import("@hono/node-ws")
  const factory = mod.createNodeWebSocket ?? mod.createNodeWebSocketServer
  return {
    createNodeWebSocketServer: (o) => {
      const r = factory(o)
      return { injectWebSocket: r.injectWebSocket, upgradeWebSocket: r.upgradeWebSocket }
    },
  }
}
