import { useState, useEffect, useCallback } from "react"
import { api, type ApiKeyInfo, type ApiKeyResult } from "../lib/api"

export default function Keys() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState("default")
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newTenant, setNewTenant] = useState("default")
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyResult | null>(null)
  const [error, setError] = useState("")

  const loadKeys = useCallback(() => {
    setLoading(true)
    api.listKeys(tenantId).then((res) => setKeys(res.keys)).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [tenantId])

  useEffect(() => { loadKeys() }, [loadKeys])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true); setError("")
    try {
      const result = await api.createKey(newName.trim(), newTenant)
      setCreatedKey(result); setNewName(""); loadKeys()
    } catch (e: any) { setError(e.message) } finally { setCreating(false) }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this key? This cannot be undone.")) return
    try { await api.revokeKey(id); loadKeys() } catch (e: any) { setError(e.message) }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage API keys for your tenants</p>
        </div>
        <button onClick={() => { setShowCreate(true); setCreatedKey(null) }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm">
          Create Key
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          {error} <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {createdKey && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-5">
          <p className="text-sm font-semibold text-emerald-800 mb-1">Key created</p>
          <p className="text-xs text-emerald-600 mb-3">Copy this key now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-emerald-200 rounded-md px-3 py-2.5 font-mono text-sm text-gray-900 break-all">{createdKey.key}</code>
            <button onClick={() => navigator.clipboard.writeText(createdKey.key)} className="px-3 py-2.5 bg-emerald-100 hover:bg-emerald-200 rounded-md text-sm text-emerald-700 font-medium transition-colors whitespace-nowrap">Copy</button>
          </div>
        </div>
      )}

      {showCreate && !createdKey && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New API Key</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Key Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. production-app" className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tenant ID</label>
              <input value={newTenant} onChange={(e) => setNewTenant(e.target.value)} placeholder="default" className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !newName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors">{creating ? "Creating..." : "Create"}</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-md transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm text-gray-500">Tenant:</label>
        <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadKeys()} className="bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-44" />
        <button onClick={loadKeys} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-md transition-colors">Load</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="font-medium text-gray-500">No keys found</p>
            <p className="text-sm mt-1">Create your first key to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-2.5 font-medium">Name</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
                <th className="text-left px-5 py-2.5 font-medium">Rate Limits</th>
                <th className="text-left px-5 py-2.5 font-medium">Created</th>
                <th className="text-left px-5 py-2.5 font-medium">Last Used</th>
                <th className="text-right px-5 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id} className="text-sm hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="text-gray-900 font-medium">{k.name}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{k.id}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${k.isActive ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-gray-500 bg-gray-50 border-gray-200"}`}>{k.isActive ? "Active" : "Revoked"}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{k.rateLimitRpm} RPM / {(k.rateLimitTpd / 1000).toFixed(0)}K TPD</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-5 py-3 text-right">
                    {k.isActive && <button onClick={() => handleRevoke(k.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Revoke</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
