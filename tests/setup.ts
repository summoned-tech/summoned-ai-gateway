// Common env defaults for tests. `env.ts` requires ADMIN_API_KEY >=32 chars.
process.env.ADMIN_API_KEY ??= "test-admin-key-at-least-32-characters-long"
process.env.NODE_ENV ??= "test"
process.env.USD_INR_RATE ??= "85"
