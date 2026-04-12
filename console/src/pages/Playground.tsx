import { useState, useRef } from "react"

interface Message { role: "user" | "assistant"; content: string }

export default function Playground() {
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("openai/gpt-4o-mini")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [responseInfo, setResponseInfo] = useState<Record<string, string>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  const gatewayUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${import.meta.env.DEV ? "localhost:4200" : window.location.host}`
    : ""

  const send = async () => {
    if (!input.trim() || loading) return
    if (!apiKey.trim()) { setError("Enter a Summoned API key (sk-smnd-...) to test"); return }

    const userMsg: Message = { role: "user", content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(""); setError(""); setLoading(true)

    try {
      const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: newMessages.map((m) => ({ role: m.role, content: m.content })) }),
      })

      const info: Record<string, string> = {}
      info.provider = res.headers.get("x-summoned-provider") ?? ""
      info.latency = res.headers.get("x-summoned-latency-ms") ?? ""
      info.cost = res.headers.get("x-summoned-cost-usd") ?? ""
      info.cache = res.headers.get("x-summoned-cache") ?? ""
      info.model = res.headers.get("x-summoned-served-by") ?? ""
      setResponseInfo(info)

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as any
        throw new Error(errBody?.error?.message ?? res.statusText)
      }

      const body = await res.json() as any
      setMessages([...newMessages, { role: "assistant", content: body.choices?.[0]?.message?.content ?? "(empty)" }])
    } catch (e: any) { setError(e.message) } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Playground</h2>
            <p className="text-sm text-gray-500 mt-0.5">Test any provider and model through the gateway</p>
          </div>
          <button onClick={() => { setMessages([]); setResponseInfo({}); setError("") }} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors font-medium">Clear</button>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">API Key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-smnd-..." className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
          <div className="w-64">
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Model</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="provider/model" className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
        </div>
        {Object.values(responseInfo).some(Boolean) && (
          <div className="flex gap-4 mt-3 text-xs text-gray-400">
            {responseInfo.provider && <span>Provider: <strong className="text-gray-600">{responseInfo.provider}</strong></span>}
            {responseInfo.model && <span>Model: <strong className="text-gray-600 font-mono">{responseInfo.model}</strong></span>}
            {responseInfo.latency && <span>Latency: <strong className="text-gray-600">{responseInfo.latency}ms</strong></span>}
            {responseInfo.cost && <span>Cost: <strong className="text-gray-600">${responseInfo.cost}</strong></span>}
            {responseInfo.cache && <span>Cache: <strong className={responseInfo.cache === "HIT" ? "text-blue-600" : "text-gray-600"}>{responseInfo.cache}</strong></span>}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-8 space-y-4 bg-gray-50">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-10 h-10 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            <p className="font-medium text-gray-500">Try any model</p>
            <p className="text-sm mt-1">e.g. <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">openai/gpt-4o</code> · <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">anthropic/claude-sonnet-4-20250514</code> · <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">groq/llama-3.3-70b-versatile</code></p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[70%] rounded-xl px-4 py-3 text-sm ${
              msg.role === "user" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-800 shadow-sm"
            }`}>
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="mx-8 mb-2 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="px-8 py-4 border-t border-gray-200 bg-white">
        <div className="flex gap-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Send a message..." disabled={loading} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-50" />
          <button onClick={send} disabled={loading || !input.trim()} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">Send</button>
        </div>
      </div>
    </div>
  )
}
