import { env } from "@/lib/env"

/**
 * AES-256-GCM encryption for storing provider API keys.
 * Uses ADMIN_API_KEY as the key derivation source.
 *
 * Stored format: base64(iv):base64(ciphertext):base64(tag)
 */

async function deriveKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(env.ADMIN_API_KEY.slice(0, 32).padEnd(32, "0"))
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  const cipher = new Uint8Array(cipherBuf)

  const toB64 = (u: Uint8Array) => Buffer.from(u).toString("base64")
  return `${toB64(iv)}:${toB64(cipher)}`
}

export async function decrypt(stored: string): Promise<string> {
  const key = await deriveKey()
  const [ivB64, cipherB64] = stored.split(":")
  const iv = new Uint8Array(Buffer.from(ivB64, "base64"))
  const cipher = new Uint8Array(Buffer.from(cipherB64, "base64"))

  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher)
  return new TextDecoder().decode(plainBuf)
}
