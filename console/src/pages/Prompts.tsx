import { useState, useEffect, useCallback } from "react"
import { api, type PromptInfo, type PromptMessage } from "../lib/api"

type Role = PromptMessage["role"]

const EMPTY_TEMPLATE: PromptMessage[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "{{user_input}}" },
]

export default function Prompts() {
  const [prompts, setPrompts] = useState<PromptInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState("default")
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [historyFor, setHistoryFor] = useState<PromptInfo | null>(null)
  const [history, setHistory] = useState<PromptInfo[]>([])

  const load = useCallback(() => {
    setLoading(true)
    api.listPrompts(tenantId)
      .then((res) => setPrompts(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const openHistory = async (p: PromptInfo) => {
    setHistoryFor(p); setHistory([])
    try {
      const res = await api.getPromptVersions(p.slug, p.tenantId)
      setHistory(res.data)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this prompt? The previous version will be promoted to latest.")) return
    try { await api.deletePrompt(id); load() } catch (e: any) { setError(e.message) }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Prompts</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Versioned prompt templates. Reference by <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">config.promptId</code> from any client.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
        >
          New Prompt
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
        <span>Tenant:</span>
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {showCreate && (
        <CreatePromptForm
          tenantId={tenantId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
          onError={setError}
        />
      )}

      {historyFor && (
        <VersionHistoryModal
          slug={historyFor.slug}
          rows={history}
          onClose={() => { setHistoryFor(null); setHistory([]) }}
          onDelete={async (id) => {
            await handleDelete(id)
            // re-fetch history
            try {
              const res = await api.getPromptVersions(historyFor.slug, historyFor.tenantId)
              setHistory(res.data)
            } catch { /* ignore */ }
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : prompts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">No prompts yet for tenant <b>{tenantId}</b>.</p>
          <p className="text-xs text-gray-400">
            Create one above, or <code className="bg-gray-100 px-1.5 py-0.5 rounded">POST /admin/prompts</code> from any script.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Slug</th>
                <th className="text-left px-4 py-2.5 font-medium">Version</th>
                <th className="text-left px-4 py-2.5 font-medium">Default model</th>
                <th className="text-left px-4 py-2.5 font-medium">Variables</th>
                <th className="text-left px-4 py-2.5 font-medium">Created</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prompts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900">{p.slug}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">v{p.version}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{p.defaultModel ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {p.variables ? Object.keys(p.variables).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => openHistory(p)}
                      className="text-xs text-gray-500 hover:text-gray-900 mr-3"
                    >
                      History
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 bg-white border border-gray-200 rounded-lg p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1.5">How to use from your code</p>
        <pre className="bg-gray-50 rounded px-3 py-2 overflow-x-auto text-[11px] text-gray-700">{`curl http://localhost:4000/v1/chat/completions \\
  -H "Authorization: Bearer sk-smnd-..." \\
  -d '{
    "model": "openai/gpt-4o",
    "messages": [],
    "config": {
      "promptId": "customer-support",
      "promptVariables": { "user_input": "Hello" }
    }
  }'`}</pre>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CreatePromptForm(props: {
  tenantId: string
  onClose: () => void
  onCreated: () => void
  onError: (e: string) => void
}) {
  const [slug, setSlug] = useState("")
  const [formTenant, setFormTenant] = useState(props.tenantId)
  const [template, setTemplate] = useState<PromptMessage[]>(EMPTY_TEMPLATE)
  const [defaultModel, setDefaultModel] = useState("")
  const [description, setDescription] = useState("")
  const [variablesText, setVariablesText] = useState("")
  const [saving, setSaving] = useState(false)

  const addRow = () => setTemplate([...template, { role: "user", content: "" }])
  const removeRow = (i: number) => setTemplate(template.filter((_, idx) => idx !== i))
  const updateRow = (i: number, patch: Partial<PromptMessage>) =>
    setTemplate(template.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))

  const submit = async () => {
    if (!slug.trim()) { props.onError("Slug is required"); return }
    if (!template.length) { props.onError("Template must have at least one message"); return }

    let variables: Record<string, string> | undefined
    if (variablesText.trim()) {
      try {
        variables = JSON.parse(variablesText) as Record<string, string>
      } catch {
        props.onError("Variables must be valid JSON, e.g. { \"tone\": \"friendly\" }"); return
      }
    }

    setSaving(true)
    try {
      await api.createPrompt({
        slug: slug.trim(),
        tenantId: formTenant.trim() || "default",
        template,
        variables,
        defaultModel: defaultModel.trim() || undefined,
        description: description.trim() || undefined,
      })
      props.onCreated()
    } catch (e: any) {
      props.onError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">New prompt version</h3>
      <p className="text-xs text-gray-500 mb-4">
        Creating a prompt with an existing slug auto-increments the version and promotes the new row to <code>latest</code>.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Field label="Slug" required>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="customer-support"
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </Field>
        <Field label="Tenant">
          <input
            value={formTenant}
            onChange={(e) => setFormTenant(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </Field>
        <Field label="Default model (optional)">
          <input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            placeholder="openai/gpt-4o"
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </Field>
        <Field label="Description (optional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </Field>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-500">Template messages</label>
          <button
            onClick={addRow}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            + Add message
          </button>
        </div>
        <div className="space-y-2">
          {template.map((m, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={m.role}
                onChange={(e) => updateRow(i, { role: e.target.value as Role })}
                className="bg-gray-50 border border-gray-200 rounded-md px-2 py-2 text-sm"
              >
                <option value="system">system</option>
                <option value="user">user</option>
                <option value="assistant">assistant</option>
              </select>
              <textarea
                value={typeof m.content === "string" ? m.content : JSON.stringify(m.content)}
                onChange={(e) => updateRow(i, { content: e.target.value })}
                placeholder="Content — use {{var}} for placeholders"
                rows={2}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              {template.length > 1 && (
                <button
                  onClick={() => removeRow(i)}
                  className="text-xs text-red-500 hover:text-red-700 px-2"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Field label="Variable defaults (JSON, optional)">
        <textarea
          value={variablesText}
          onChange={(e) => setVariablesText(e.target.value)}
          placeholder='{ "tone": "friendly", "max_bullets": "5" }'
          rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={props.onClose}
          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-md transition-colors"
        >
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  )
}

function Field(props: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {props.label}
        {props.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {props.children}
    </div>
  )
}

function VersionHistoryModal(props: {
  slug: string
  rows: PromptInfo[]
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={props.onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Version history</h3>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{props.slug}</p>
          </div>
          <button
            onClick={props.onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {props.rows.length === 0 ? (
            <div className="px-5 py-6 text-xs text-gray-400">No versions.</div>
          ) : props.rows.map((row) => (
            <div key={row.id} className="px-5 py-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">v{row.version}</span>
                  {row.isLatest && row.isActive && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                      latest
                    </span>
                  )}
                  {!row.isActive && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      deleted
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 font-mono bg-gray-50 rounded px-2 py-1.5 whitespace-pre-wrap">
                  {JSON.stringify(row.template, null, 2)}
                </div>
              </div>
              {row.isActive && (
                <button
                  onClick={() => props.onDelete(row.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
