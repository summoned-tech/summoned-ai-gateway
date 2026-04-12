import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/console/",
  build: {
    outDir: "../public/console",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/admin": "http://localhost:4000",
      "/v1": "http://localhost:4000",
      "/ws": { target: "ws://localhost:4000", ws: true },
    },
  },
})
