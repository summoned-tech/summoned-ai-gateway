import { getAdminKey, reportAuthError } from "./adminKey"

const BASE = import.meta.env.DEV ? "http://localhost:4200" : ""
const API = `${BASE}/console/api`

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const adminKey = getAdminKey()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (adminKey) headers["x-admin-key"] = adminKey

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    reportAuthError()
    throw new Error("Admin key required")
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error((err as any)?.error?.message ?? res.statusText)
  }

  return res.json()
}

export const api = {
  getLogs: (limit = 100, source = "buffer") =>
    request<{ data: LogEntry[]; source: string }>("GET", `/logs?limit=${limit}&source=${source}`),

  getStats: (period = "24h") =>
    request<StatsResponse>("GET", `/stats?period=${period}`),

  getProviders: () =>
    request<{ data: ProviderInfo[] }>("GET", `/providers`),

  createKey: (name: string, tenantId: string) =>
    request<ApiKeyResult>("POST", `/keys`, { name, tenantId }),

  listKeys: (tenantId: string) =>
    request<{ keys: ApiKeyInfo[] }>("GET", `/keys?tenantId=${tenantId}`),

  revokeKey: (id: string) =>
    request<{ id: string; revoked: boolean }>("DELETE", `/keys/${id}`),

  createVirtualKey: (body: CreateVirtualKeyBody) =>
    request<VirtualKeyInfo>("POST", `/virtual-keys`, body),

  listVirtualKeys: (tenantId: string) =>
    request<{ data: VirtualKeyInfo[] }>("GET", `/virtual-keys?tenantId=${tenantId}`),

  revokeVirtualKey: (id: string) =>
    request<{ id: string; revoked: boolean }>("DELETE", `/virtual-keys/${id}`),
}

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
  errorMessage?: string | null
  cacheHit?: boolean
}

export interface StatsResponse {
  period: string
  since: string
  requests: { total: number; success: number; errors: number; errorRate: number }
  tokens: { input: number; output: number; total: number }
  latency: { avg: number; p50: number; p95: number; p99: number }
  topModels: { model: string; provider: string; count: number; totalTokens: number }[]
  activeApiKeys: number
  providers: string[]
  costUsd?: number
}

export interface ProviderInfo {
  id: string
  name: string
  supportsEmbeddings: boolean
  health: { state: "closed" | "open" | "half_open"; failures: number }
  avgLatencyMs: number | null
}

export interface ApiKeyResult {
  id: string
  key: string
  name: string
  tenantId: string
  rateLimitRpm: number
  rateLimitTpd: number
  createdAt: string
}

export interface ApiKeyInfo {
  id: string
  name: string
  tenantId: string
  rateLimitRpm: number
  rateLimitTpd: number
  isActive: boolean
  createdAt: string
  lastUsedAt: string | null
}

export interface CreateVirtualKeyBody {
  name: string
  tenantId: string
  providerId: string
  apiKey: string
  providerConfig?: Record<string, string>
}

export interface VirtualKeyInfo {
  id: string
  name: string
  tenantId: string
  providerId: string
  providerConfig?: Record<string, string> | null
  isActive: boolean
  createdAt: string
  lastUsedAt: string | null
}
