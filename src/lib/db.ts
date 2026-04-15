import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "@/lib/env"
import * as schema from "@/db/schema"

// Allow gateway to start without a DB when operating in pure BYOK mode.
// Any code path that touches the DB will throw a clear error rather than
// crashing at import time.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db
  if (!env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not configured. " +
        "Set POSTGRES_URL in your .env, or run in pure BYOK mode where DB features are not required.",
    )
  }
  const client = postgres(env.POSTGRES_URL)
  _db = drizzle(client, { schema })
  return _db
}

// Proxy so call-sites can keep using `db.select(...)` etc. unchanged.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop: string | symbol) {
    return (getDb() as any)[prop]
  },
})

export * from "@/db/schema"
