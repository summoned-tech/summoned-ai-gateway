// Single source of truth for the console's ADMIN_API_KEY.
// Used by both the REST client (api.ts) and the log WebSocket (useWebSocket.ts).
// The key is stored in localStorage and sent on every request as x-admin-key.

const STORAGE_KEY = "summoned_admin_key"

type Listener = (key: string) => void
const listeners = new Set<Listener>()

export function getAdminKey(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(STORAGE_KEY) ?? ""
}

export function setAdminKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key)
  for (const fn of listeners) fn(key)
}

export function clearAdminKey(): void {
  localStorage.removeItem(STORAGE_KEY)
  for (const fn of listeners) fn("")
}

export function onAdminKeyChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Track auth errors from fetch() — surface them at the App level so any page
// can trigger the global auth prompt without each page handling 401 itself.
let authErrorCount = 0
const authErrorListeners = new Set<() => void>()

export function reportAuthError(): void {
  authErrorCount++
  for (const fn of authErrorListeners) fn()
}

export function onAuthError(fn: () => void): () => void {
  authErrorListeners.add(fn)
  return () => authErrorListeners.delete(fn)
}

export function hasAuthError(): boolean {
  return authErrorCount > 0
}

export function resetAuthErrors(): void {
  authErrorCount = 0
}
