import { useState, useEffect } from "react"
import { api, type ProviderInfo } from "../lib/api"

const STATE_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  closed:    { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Healthy",       dot: "bg-emerald-500" },
  open:      { bg: "bg-red-50 border-red-200",         text: "text-red-700",     label: "Circuit Open",  dot: "bg-red-500" },
  half_open: { bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   label: "Recovering",    dot: "bg-amber-400" },
}

function LatencyBar({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-gray-400 text-xs">No data yet</span>
  const color = ms < 1000 ? "text-emerald-600" : ms < 3000 ? "text-amber-600" : "text-red-600"
  return <span className={`text-xs font-medium ${color}`}>{ms.toFixed(0)} ms avg</span>
}

export default function Providers() {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = () => {
    setLoading(true)
    api.getProviders().then((res) => setProviders(res.data)).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  // Sort by latency for display: fastest first, unknown last
  const sorted = [...providers].sort((a, b) => {
    if (a.avgLatencyMs === null) return 1
    if (b.avgLatencyMs === null) return -1
    return a.avgLatencyMs - b.avgLatencyMs
  })

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Providers</h2>
          <p className="text-sm text-gray-500 mt-0.5">Registered LLM providers — health, latency, and routing status</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-md transition-colors">Refresh</button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading && providers.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : providers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 shadow-sm">
          <p className="font-medium text-gray-500">No providers registered</p>
          <p className="text-sm mt-1">Set provider API keys in your .env to enable them</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((p, rank) => {
            const s = STATE_STYLES[p.health.state] ?? STATE_STYLES.closed
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
                      {rank === 0 && p.avgLatencyMs !== null && (
                        <span className="text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">Fastest</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{p.id}/&lt;model&gt;</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${s.bg} ${s.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Avg Latency</span>
                    <LatencyBar ms={p.avgLatencyMs} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Embeddings</span>
                    <span className={p.supportsEmbeddings ? "text-emerald-600 font-medium text-xs" : "text-gray-400 text-xs"}>
                      {p.supportsEmbeddings ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Circuit</span>
                    <span className="text-gray-700 text-xs capitalize">{p.health.state.replace("_", " ")}</span>
                  </div>
                  {p.health.failures > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Failures</span>
                      <span className="text-red-600 font-medium text-xs">{p.health.failures}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Routing strategy guide */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Smart Routing</h3>
        <p className="text-xs text-blue-700 mb-3">
          Pass <code className="bg-blue-100 px-1 rounded">routing</code> in your request config to auto-select providers:
        </p>
        <div className="space-y-1.5">
          <div className="flex gap-2 text-xs">
            <code className="bg-white border border-blue-200 px-2 py-0.5 rounded text-blue-800 font-mono w-20 text-center shrink-0">default</code>
            <span className="text-blue-600">Use model chain in the order you specified</span>
          </div>
          <div className="flex gap-2 text-xs">
            <code className="bg-white border border-blue-200 px-2 py-0.5 rounded text-blue-800 font-mono w-20 text-center shrink-0">cost</code>
            <span className="text-blue-600">Sort by cheapest input token price first</span>
          </div>
          <div className="flex gap-2 text-xs">
            <code className="bg-white border border-blue-200 px-2 py-0.5 rounded text-blue-800 font-mono w-20 text-center shrink-0">latency</code>
            <span className="text-blue-600">Sort by lowest observed average latency first</span>
          </div>
        </div>
        <pre className="mt-3 text-[11px] bg-white border border-blue-200 rounded p-3 text-gray-700 overflow-x-auto">{`// In your request body:
{
  "model": "openai/gpt-4o",
  "fallback_models": ["anthropic/claude-3-5-haiku-20241022", "groq/llama-3.3-70b-versatile"],
  "config": { "routing": "cost" }
}`}</pre>
      </div>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Adding a provider</h3>
        <ol className="text-sm text-gray-500 space-y-1 list-decimal list-inside">
          <li>Set the API key in <code className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code> (e.g. <code className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-xs">OPENAI_API_KEY=sk-...</code>)</li>
          <li>Restart the gateway</li>
          <li>Use in requests: <code className="text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-xs">openai/gpt-4o</code></li>
        </ol>
      </div>
    </div>
  )
}
