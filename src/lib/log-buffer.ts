/**
 * In-memory ring buffer for recent request logs.
 * Holds the last N logs so the console loads instantly without DB queries.
 * Also broadcasts new logs to connected WebSocket clients.
 */

export interface LogEntry {
  id: string
  timestamp: string
  provider: string
  requestedModel: string
  resolvedModel: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  streaming: boolean
  status: "success" | "error" | "rate_limited" | "auth_failed"
  costUsd: number
  costInr: number
  tenantId: string
  apiKeyId: string
  userId?: string | null
  errorMessage?: string | null
}

type LogListener = (entry: LogEntry) => void

const MAX_SIZE = 1000
const buffer: LogEntry[] = []
const listeners = new Set<LogListener>()

export function pushLog(entry: LogEntry): void {
  if (buffer.length >= MAX_SIZE) buffer.shift()
  buffer.push(entry)

  for (const listener of listeners) {
    try { listener(entry) } catch { /* ignore listener errors */ }
  }
}

export function getRecentLogs(limit = 100): LogEntry[] {
  return buffer.slice(-limit).reverse()
}

export function getLogCount(): number {
  return buffer.length
}

export function subscribe(fn: LogListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
