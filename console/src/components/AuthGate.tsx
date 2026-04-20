import { useEffect, useState } from "react"
import {
  getAdminKey,
  setAdminKey,
  onAuthError,
  resetAuthErrors,
} from "../lib/adminKey"

interface Props {
  children: React.ReactNode
}

// Global admin-key gate. Renders a blocking prompt when:
//   (a) no admin key is stored, or
//   (b) any API call / WebSocket reported a 401/UNAUTHORIZED.
// Once the key is saved, triggers a full reload so all panels + WS re-auth.
export default function AuthGate({ children }: Props) {
  const [locked, setLocked] = useState<boolean>(() => !getAdminKey())
  const [keyInput, setKeyInput] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const off = onAuthError(() => setLocked(true))
    return off
  }, [])

  if (!locked) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm w-full max-w-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Admin key required</h3>
            <p className="text-xs text-gray-500">The console is protected by ADMIN_API_KEY</p>
          </div>
        </div>
        <input
          autoFocus
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && keyInput.trim()) submit()
          }}
          placeholder="Enter ADMIN_API_KEY..."
          className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 mb-3"
        />
        <button
          onClick={submit}
          disabled={!keyInput.trim() || submitting}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {submitting ? "Verifying..." : "Connect"}
        </button>
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
          Your key is saved in <code className="bg-gray-100 px-1 rounded">localStorage</code> for this browser only.
          Clear it from the sidebar to sign out.
        </p>
      </div>
    </div>
  )

  function submit() {
    const trimmed = keyInput.trim()
    if (!trimmed) return
    setSubmitting(true)
    setAdminKey(trimmed)
    resetAuthErrors()
    // Full reload so WebSocket reconnects with the new key and every page
    // re-fetches. Cheapest correct behaviour.
    window.location.reload()
  }
}
