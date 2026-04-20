import { useState, useEffect } from "react"
import Sidebar from "./components/Sidebar"
import AuthGate from "./components/AuthGate"
import Dashboard from "./pages/Dashboard"
import Logs from "./pages/Logs"
import Keys from "./pages/Keys"
import VirtualKeys from "./pages/VirtualKeys"
import Providers from "./pages/Providers"
import Playground from "./pages/Playground"

export type Page = "dashboard" | "logs" | "keys" | "virtual-keys" | "providers" | "playground"

export default function App() {
  const [page, setPage] = useState<Page>("logs")

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setPage(hash as Page)
  }, [])

  useEffect(() => {
    window.location.hash = page
  }, [page])

  return (
    <AuthGate>
      <div className="flex h-screen bg-gray-50 text-gray-900">
        <Sidebar currentPage={page} onNavigate={setPage} />
        <main className="flex-1 overflow-auto">
          {page === "dashboard" && <Dashboard />}
          {page === "logs" && <Logs />}
          {page === "keys" && <Keys />}
          {page === "virtual-keys" && <VirtualKeys />}
          {page === "providers" && <Providers />}
          {page === "playground" && <Playground />}
        </main>
      </div>
    </AuthGate>
  )
}
