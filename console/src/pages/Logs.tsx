import { useState, useMemo } from "react"
import { useLogStream, setAdminKey } from "../lib/useWebSocket"
import type { LogEntry } from "../lib/api"

const STATUS_STYLES: Record<string, string> = {
  success: "text-emerald-700 bg-emerald-50 border-emerald-200",
  error: "text-red-700 bg-red-50 border-red-200",
  rate_limited: "text-amber-700 bg-amber-50 border-amber-200",
  auth_failed: "text-red-700 bg-red-50 border-red-200",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_STYLES[status] ?? "text-gray-600 bg-gray-50 border-gray-200"}`}>
      {status.replace("_", " ")}
    </span>
  )
}

function LogDetailPanel({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white border-l border-gray-200 overflow-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Request Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="ID" value={log.id} mono />
          <Field label="Status" value={<StatusBadge status={log.status} />} />
          <Field label="Timestamp" value={new Date(log.timestamp).toLocaleString()} />
          <Field label="Provider" value={log.provider} />
          <Field label="Requested Model" value={log.requestedModel} mono />
          <Field label="Resolved Model" value={log.resolvedModel} mono />
          <Field label="Input Tokens" value={log.inputTokens?.toLocaleString()} />
          <Field label="Output Tokens" value={log.outputTokens?.toLocaleString()} />
          <Field label="Latency" value={`${log.latencyMs}ms`} />
          <Field label="Streaming" value={log.streaming ? "Yes" : "No"} />
          <Field label="Cache Hit" value={log.cacheHit ? "Yes" : "No"} />
          <Field label="Cost (USD)" value={`$${log.costUsd?.toFixed(6) ?? "—"}`} />
          <Field label="Cost (INR)" value={`₹${log.costInr?.toFixed(4) ?? "—"}`} />
          <Field label="Tenant" value={log.tenantId} mono />
          <Field label="API Key" value={log.apiKeyId} mono />
          {log.errorMessage && <Field label="Error" value={<span className="text-red-600">{log.errorMessage}</span>} />}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  )
}

export default function Logs() {
  const { logs, connected, authError, clear } = useLogStream()
  const [keyInput, setKeyInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [providerFilter, setProviderFilter] = useState("all")
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

  const providers = useMemo(() => {
    const set = new Set(logs.map((l) => l.provider))
    return Array.from(set).sort()
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false
      if (providerFilter !== "all" && l.provider !== providerFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return l.requestedModel.toLowerCase().includes(q) || l.resolvedModel.toLowerCase().includes(q) || l.provider.toLowerCase().includes(q) || l.tenantId.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
      }
      return true
    })
  }, [logs, search, statusFilter, providerFilter])

  // Auth error gate — show key prompt instead of the full log UI
  if (authError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm w-full max-w-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Admin key required</h3>
              <p className="text-xs text-gray-500">Live logs are protected</p>
            </div>
          </div>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && keyInput.trim()) {
                setAdminKey(keyInput.trim())
                window.location.reload()
              }
            }}
            placeholder="Enter ADMIN_API_KEY..."
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 mb-3"
          />
          <button
            onClick={() => { if (keyInput.trim()) { setAdminKey(keyInput.trim()); window.location.reload() } }}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Live Logs</h2>
            <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? "text-emerald-600" : "text-red-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-400"}`} />
              {connected ? "Connected" : "Reconnecting..."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{filtered.length} of {logs.length}</span>
            <button onClick={clear} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors font-medium">Clear</button>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search model, provider, tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="rate_limited">Rate limited</option>
          </select>
          <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="all">All providers</option>
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-10 h-10 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <p className="font-medium text-gray-500">No logs yet</p>
            <p className="text-sm mt-1">Logs appear here in real-time as requests come in</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="text-left px-5 py-2.5 font-medium">Time</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
                <th className="text-left px-5 py-2.5 font-medium">Provider</th>
                <th className="text-left px-5 py-2.5 font-medium">Model</th>
                <th className="text-right px-5 py-2.5 font-medium">Tokens</th>
                <th className="text-right px-5 py-2.5 font-medium">Latency</th>
                <th className="text-right px-5 py-2.5 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((log) => (
                <tr key={log.id} onClick={() => setSelectedLog(log)} className="text-sm hover:bg-blue-50/50 cursor-pointer transition-colors">
                  <td className="px-5 py-2.5 text-gray-400 whitespace-nowrap text-xs font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="px-5 py-2.5"><StatusBadge status={log.status} /></td>
                  <td className="px-5 py-2.5 text-gray-600">{log.provider}</td>
                  <td className="px-5 py-2.5 font-mono text-gray-800 text-xs max-w-[200px] truncate">
                    {log.resolvedModel}
                    {log.cacheHit && <span className="ml-1.5 text-[10px] text-blue-600 font-sans font-medium">(cached)</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-gray-500 whitespace-nowrap tabular-nums">{(log.inputTokens ?? 0) + (log.outputTokens ?? 0)}</td>
                  <td className="px-5 py-2.5 text-right text-gray-500 whitespace-nowrap tabular-nums">{log.latencyMs}ms</td>
                  <td className="px-5 py-2.5 text-right text-gray-500 whitespace-nowrap tabular-nums">${log.costUsd?.toFixed(5) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedLog && <LogDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  )
}
