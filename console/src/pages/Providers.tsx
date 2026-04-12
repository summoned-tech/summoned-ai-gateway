import { useState, useEffect } from "react"
import { api, type ProviderInfo } from "../lib/api"

const STATE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  closed: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Healthy" },
  open: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Circuit Open" },
  half_open: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Recovering" },
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

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Providers</h2>
          <p className="text-sm text-gray-500 mt-0.5">Registered LLM providers and health status</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-md transition-colors">Refresh</button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading && providers.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-36 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : providers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400 shadow-sm">
          <p className="font-medium text-gray-500">No providers registered</p>
          <p className="text-sm mt-1">Set provider API keys in your .env to enable them</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => {
            const s = STATE_STYLES[p.health.state] ?? STATE_STYLES.closed
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{p.id}/&lt;model&gt;</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${s.bg} ${s.text}`}>{s.label}</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Embeddings</span>
                    <span className={p.supportsEmbeddings ? "text-emerald-600 font-medium" : "text-gray-400"}>{p.supportsEmbeddings ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Circuit</span>
                    <span className="text-gray-700">{p.health.state}</span>
                  </div>
                  {p.health.failures > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Failures</span>
                      <span className="text-red-600 font-medium">{p.health.failures}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
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
