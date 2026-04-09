import { createMiddleware } from "hono/factory"
import { nanoid } from "nanoid"

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const existing = c.req.header("x-request-id")
  c.res.headers.set("x-request-id", existing ?? nanoid())
  await next()
})
