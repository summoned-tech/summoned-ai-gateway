import { env } from "@/lib/env"

// ---------------------------------------------------------------------------
// AES-256-GCM encryption for storing provider API keys (virtual keys).
//
// Key derivation: HKDF-SHA-256 from VIRTUAL_KEY_SECRET (or ADMIN_API_KEY as
// fallback). HKDF ensures the key material has full 256-bit entropy regardless
// of the source string length, and that the encryption key is domain-separated
// from all other uses of the secret.
//
// Stored format: base64(iv):base64(ciphertext+tag)  — 2 colon-separated parts.
// WebCrypto appends the 16-byte GCM auth tag to the ciphertext automatically.
// ---------------------------------------------------------------------------

let _cachedKey: CryptoKey | null = null

async function deriveKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey

  const secret = env.VIRTUAL_KEY_SECRET || env.ADMIN_API_KEY
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  )

  _cachedKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("summoned-virtual-key-v1"),
      info: new TextEncoder().encode("aes-gcm-256"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )

  return _cachedKey
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  )

  const toB64 = (u: Uint8Array) => Buffer.from(u).toString("base64")
  return `${toB64(iv)}:${toB64(new Uint8Array(cipherBuf))}`
}

export async function decrypt(stored: string): Promise<string> {
  const key = await deriveKey()
  const parts = stored.split(":")
  if (parts.length !== 2) throw new Error("Invalid encrypted value format")

  const iv = new Uint8Array(Buffer.from(parts[0], "base64"))
  const cipher = new Uint8Array(Buffer.from(parts[1], "base64"))

  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher)
  return new TextDecoder().decode(plainBuf)
}

// ---------------------------------------------------------------------------
// Timing-safe string comparison — prevents timing attacks on secret keys.
// Always runs in constant time regardless of where the strings differ.
// ---------------------------------------------------------------------------
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)

  // Pad the shorter buffer so lengths match (length itself may reveal info but
  // we still need to compare content in constant time)
  const maxLen = Math.max(aBytes.length, bBytes.length)
  const aPadded = new Uint8Array(maxLen)
  const bPadded = new Uint8Array(maxLen)
  aPadded.set(aBytes)
  bPadded.set(bBytes)

  let diff = aBytes.length ^ bBytes.length // non-zero if lengths differ
  for (let i = 0; i < maxLen; i++) {
    diff |= aPadded[i] ^ bPadded[i]
  }
  return diff === 0
}
