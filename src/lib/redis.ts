import Redis from "ioredis"
import { env } from "@/lib/env"

export const isRedisEnabled = !!env.REDIS_URL

/**
 * No-op Redis stub used when REDIS_URL is not configured.
 * Returns safe defaults so all callers work without Redis.
 * In this mode: caching, latency EMA, and RPM persistence are in-memory only.
 */
class NoOpRedis {
  async connect() { return this }
  async quit() {}
  async get(_key: string): Promise<string | null> { return null }
  async set(_key: string, _value: string): Promise<"OK"> { return "OK" }
  async setex(_key: string, _ttl: number, _value: string): Promise<"OK"> { return "OK" }
  async incrby(_key: string, _n: number): Promise<number> { return 0 }
  async expire(_key: string, _ttl: number): Promise<number> { return 1 }
  async ping(): Promise<"PONG"> { return "PONG" }
  async del(_key: string): Promise<number> { return 0 }
  pipeline() {
    const noop = () => p
    const p: any = {
      zremrangebyscore: noop, zadd: noop, zcard: noop, pexpire: noop,
      incrby: noop, expire: noop,
      exec: async () => [[null, 0], [null, 0], [null, 0], [null, 0]],
    }
    return p
  }
}

export const redis: Redis | NoOpRedis = isRedisEnabled
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, enableReadyCheck: true, lazyConnect: true })
  : new NoOpRedis()
