import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "@/lib/env"
import * as schema from "@/db/schema"

const client = postgres(env.POSTGRES_URL)
export const db = drizzle(client, { schema })

export * from "@/db/schema"
