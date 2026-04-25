/**
 * Intelligence Terminal API key persistence (browser-only).
 *
 * ## Threat model (honest)
 * - This **does not** protect against XSS or malicious same-origin scripts: any
 *   script on the page can read `localStorage` and use Web Crypto the same way
 *   this module does. Treat XSS as full compromise of the pasted key.
 * - The PBKDF2 password is a **fixed constant in source** — it is not a user
 *   secret. It exists only as KDF input together with the per-session salt.
 * - **Session-bound `sessionStorage` salt** (see SESSION_STORAGE_SALT): the
 *   ciphertext in `localStorage` cannot be decrypted without that salt (new tab
 *   or browser restart clears it → user must paste again). That limits offline
 *   reuse of a stolen `localStorage` blob **without** the tab session; it does
 *   not stop an attacker who already runs JS in the origin.
 * - If `crypto.subtle` is unavailable, we store `{ v: 0, k }` in plain
 *   `localStorage` with `console.warn` so older Safari does not crash the UI.
 */

export const LOCAL_STORAGE_KEY = 'cc_terminal_key_v1'
export const SESSION_STORAGE_SALT = 'cc_terminal_salt'

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_PASSWORD = new TextEncoder().encode('cc_terminal_keywrap_v1')
const AES_IV_LENGTH = 12

/** Satisfies DOM `BufferSource` typing across TS lib versions. */
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource
}

/** True when AES-GCM + PBKDF2 can be used (requires `window.crypto.subtle`). */
export const isStrongCryptoAvailable: boolean =
  typeof window !== 'undefined' && typeof window.crypto !== 'undefined' && !!window.crypto.subtle

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function getOrCreateSessionSaltBytes(): Uint8Array {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    throw new Error('sessionStorage unavailable')
  }
  const existing = window.sessionStorage.getItem(SESSION_STORAGE_SALT)
  if (existing) {
    return base64ToBytes(existing)
  }
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  window.sessionStorage.setItem(SESSION_STORAGE_SALT, bytesToBase64(salt))
  return salt
}

async function deriveAesKey(salt: Uint8Array): Promise<CryptoKey> {
  const subtle = window.crypto.subtle
  const keyMaterial = await subtle.importKey('raw', asBufferSource(PBKDF2_PASSWORD), 'PBKDF2', false, [
    'deriveKey',
  ])
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asBufferSource(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

type StoredEncryptedV1 = { v: 1; iv: string; ct: string }
type StoredPlainV1 = { v: 0; k: string }

function parseStored(raw: string | null): StoredEncryptedV1 | StoredPlainV1 | null {
  if (raw == null || raw === '') return null
  try {
    const o = JSON.parse(raw) as unknown
    if (o && typeof o === 'object' && 'v' in o) {
      const v = (o as { v: unknown }).v
      if (v === 1 && 'iv' in o && 'ct' in o) {
        const iv = (o as { iv?: unknown }).iv
        const ct = (o as { ct?: unknown }).ct
        if (typeof iv === 'string' && typeof ct === 'string') return { v: 1, iv, ct }
      }
      if (v === 0 && 'k' in o && typeof (o as { k?: unknown }).k === 'string') {
        return { v: 0, k: (o as { k: string }).k }
      }
    }
  } catch {
    return null
  }
  return null
}

/** True if localStorage holds a v1 AES-GCM blob (may be undecryptable if session salt is missing). */
export function isCurrentKeyEncrypted(): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  const parsed = parseStored(raw)
  return parsed !== null && parsed.v === 1
}

/**
 * Persist the raw API key. Uses AES-GCM when `crypto.subtle` exists; otherwise plain storage + warn.
 */
export async function storeEncryptedKey(rawKey: string): Promise<void> {
  if (typeof window === 'undefined') return
  const trimmed = rawKey.trim()
  if (!trimmed) {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    return
  }

  if (!isStrongCryptoAvailable) {
    console.warn(
      '[client-key-store] Web Crypto (subtle) unavailable — storing API key in plain localStorage (not recommended).'
    )
    const payload: StoredPlainV1 = { v: 0, k: trimmed }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
    return
  }

  try {
    const salt = getOrCreateSessionSaltBytes()
    const aesKey = await deriveAesKey(salt)
    const iv = new Uint8Array(AES_IV_LENGTH)
    crypto.getRandomValues(iv)
    const plaintext = new TextEncoder().encode(trimmed)
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      aesKey,
      asBufferSource(plaintext)
    )
    const payload: StoredEncryptedV1 = {
      v: 1,
      iv: bytesToBase64(iv),
      ct: bytesToBase64(new Uint8Array(ciphertext)),
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.warn(
      '[client-key-store] AES-GCM storage failed (e.g. sessionStorage blocked) — falling back to plain localStorage.',
      e
    )
    const payload: StoredPlainV1 = { v: 0, k: trimmed }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
  }
}

/**
 * Load and decrypt the API key, or null if missing / wrong session salt / corrupt blob.
 */
export async function loadEncryptedKey(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  const parsed = parseStored(raw)
  if (!parsed) return null

  if (parsed.v === 0) {
    return parsed.k
  }

  if (!isStrongCryptoAvailable) {
    console.warn('[client-key-store] Cannot decrypt: Web Crypto (subtle) unavailable.')
    return null
  }

  const saltB64 = window.sessionStorage.getItem(SESSION_STORAGE_SALT)
  if (!saltB64) return null

  let salt: Uint8Array
  try {
    salt = base64ToBytes(saltB64)
  } catch {
    return null
  }

  let iv: Uint8Array
  let ct: Uint8Array
  try {
    iv = base64ToBytes(parsed.iv)
    ct = base64ToBytes(parsed.ct)
  } catch {
    return null
  }

  try {
    const aesKey = await deriveAesKey(salt)
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      aesKey,
      asBufferSource(ct)
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    return null
  }
}

/** Remove persisted key and session salt. */
export function clearKey(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_SALT)
  } catch {
    /* ignore */
  }
}

/** Display-only mask, e.g. `cc_live_AB12...XY34`. */
export function maskKey(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const prefixes = ['cc_live_', 'cc_sentinel_'] as const
  for (const p of prefixes) {
    if (s.startsWith(p)) {
      const rest = s.slice(p.length)
      if (rest.length <= 8) {
        return rest.length === 0 ? p : `${p}${rest.slice(0, 2)}...`
      }
      return `${p}${rest.slice(0, 4)}...${s.slice(-4)}`
    }
  }
  if (s.length <= 12) return '••••••••'
  return `${s.slice(0, 4)}...${s.slice(-4)}`
}
