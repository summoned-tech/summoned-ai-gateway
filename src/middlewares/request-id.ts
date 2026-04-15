import { createMiddleware } from "hono/factory"
import { nanoid } from "nanoid"

// Accept caller-supplied request IDs only if they are safe alphanumeric strings.
// Reflecting arbitrary header values into response headers enables log injection
// and, in some proxy setups, response splitting attacks.
const SAFE_REQUEST_ID = /^[a-zA-Z0-9_-]{1,64}$/

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const incoming = c.req.header("x-request-id")
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : nanoid()
  c.res.headers.set("x-request-id", requestId)
  await next()
})
