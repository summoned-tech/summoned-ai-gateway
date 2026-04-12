import { useEffect, useRef, useState, useCallback } from "react"
import type { LogEntry } from "./api"

const MAX_LOGS = 500

export function useLogStream() {
  const [logs, setLogs] = useState<LogEntry[]>([] as LogEntry[])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = import.meta.env.DEV ? "localhost:4000" : window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/logs`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

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

    ws.onclose = () => {
      setConnected(false)
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

  return { logs, connected, clear }
}
