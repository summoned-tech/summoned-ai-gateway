import { useEffect, useRef, useState, useCallback } from "react"
import type { LogEntry } from "./api"

const MAX_LOGS = 500

// Console is served from the gateway itself — use localStorage to persist the
// admin key across page refreshes so users don't have to re-enter it.
function getAdminKey(): string {
  return localStorage.getItem("summoned_admin_key") ?? ""
}

export function setAdminKey(key: string): void {
  localStorage.setItem("summoned_admin_key", key)
}

export function useLogStream() {
  const [logs, setLogs] = useState<LogEntry[]>([] as LogEntry[])
  const [connected, setConnected] = useState(false)
  const [authError, setAuthError] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = import.meta.env.DEV ? "localhost:4200" : window.location.host
    const key = getAdminKey()
    // Pass key as query param — browser WS API cannot set custom headers
    const ws = new WebSocket(`${protocol}//${host}/ws/logs${key ? `?key=${encodeURIComponent(key)}` : ""}`)
    wsRef.current = ws

    ws.onopen = () => { setConnected(true); setAuthError(false) }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === "init" && Array.isArray(msg.logs)) {
          setLogs(msg.logs.slice(0, MAX_LOGS))
        } else if (msg.type === "log" && msg.data) {
          setLogs((prev) => [msg.data, ...prev].slice(0, MAX_LOGS))
        }
      } catch { /* ignore */ }
    }

    ws.onclose = (ev) => {
      setConnected(false)
      // Code 1008 = policy violation (server rejected auth) — don't reconnect
      if (ev.code === 1008 || ev.reason?.includes("UNAUTHORIZED")) {
        setAuthError(true)
        return
      }
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const clear = useCallback(() => setLogs([]), [])

  return { logs, connected, authError, clear }
}
