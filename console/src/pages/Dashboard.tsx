import { useState, useEffect } from "react"
import { api, type StatsResponse } from "../lib/api"

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("24h")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    setLoading(true)
    api.getStats(period)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [period])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-7 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">Failed to load stats</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <button onClick={() => { setError(""); setLoading(true); api.getStats(period).then(setStats).catch(e => setError(e.message)).finally(() => setLoading(false)) }} className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-md text-sm text-red-700 transition-colors">Retry</button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const successRate = stats.requests.total > 0
    ? ((stats.requests.success / stats.requests.total) * 100).toFixed(1)
    : "—"

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Overview of your gateway activity</p>
        </div>
        <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
          {(["24h", "7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Requests" value={stats.requests.total.toLocaleString()} />
        <StatCard label="Success Rate" value={`${successRate}%`} accent={Number(successRate) > 95 ? "text-emerald-600" : "text-amber-600"} />
        <StatCard label="Avg Latency" value={`${stats.latency.avg}ms`} sub={`p95: ${stats.latency.p95}ms · p99: ${stats.latency.p99}ms`} />
        <StatCard label="Total Tokens" value={stats.tokens.total.toLocaleString()} sub={`${stats.tokens.input.toLocaleString()} in / ${stats.tokens.output.toLocaleString()} out`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active API Keys" value={stats.activeApiKeys} />
        <StatCard label="Providers" value={stats.providers.length} sub={stats.providers.join(", ")} />
        <StatCard label="Errors" value={stats.requests.errors} accent={stats.requests.errors > 0 ? "text-red-600" : "text-gray-400"} />
        <StatCard label="Error Rate" value={`${stats.requests.errorRate}%`} accent={stats.requests.errorRate > 5 ? "text-red-600" : "text-emerald-600"} />
      </div>

      {stats.topModels.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Top Models</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider bg-gray-50">
                <th className="text-left px-5 py-2.5 font-medium">Model</th>
                <th className="text-left px-5 py-2.5 font-medium">Provider</th>
                <th className="text-right px-5 py-2.5 font-medium">Requests</th>
                <th className="text-right px-5 py-2.5 font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.topModels.map((m, i) => (
                <tr key={i} className="text-sm hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-gray-900 text-xs">{m.model}</td>
                  <td className="px-5 py-3 text-gray-500">{m.provider}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{m.count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{m.totalTokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
