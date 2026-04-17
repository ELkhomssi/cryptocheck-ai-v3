/**
 * MV3 extension key storage — chrome.storage.local (ciphertext) + chrome.storage.session (salt) when available.
 * Crypto parameters match lib/crypto/client-key-store.ts for interoperability.
 */

export const LOCAL_STORAGE_KEY = 'cc_terminal_key_v1'
export const SESSION_STORAGE_SALT = 'cc_terminal_salt'

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_PASSWORD = new TextEncoder().encode('cc_terminal_keywrap_v1')
const AES_IV_LENGTH = 12

function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource
}

export const isStrongCryptoAvailable: boolean =
  typeof window !== 'undefined' && typeof window.crypto !== 'undefined' && !!window.crypto?.subtle

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

async function saltStorage(): Promise<chrome.storage.StorageArea> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    return chrome.storage.session
  }
  return chrome.storage.local
}

async function getOrCreateSessionSaltBytes(): Promise<Uint8Array> {
  const area = await saltStorage()
  const got = await area.get(SESSION_STORAGE_SALT)
  const existing = got[SESSION_STORAGE_SALT]
  if (typeof existing === 'string') {
    return base64ToBytes(existing)
  }
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const b64 = bytesToBase64(salt)
  await area.set({ [SESSION_STORAGE_SALT]: b64 })
  return salt
}

async function deriveAesKey(salt: Uint8Array): Promise<CryptoKey> {
  const subtle = window.crypto.subtle
  const keyMaterial = await subtle.importKey('raw', asBufferSource(PBKDF2_PASSWORD), 'PBKDF2', false, ['deriveKey'])
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

export async function isCurrentKeyEncrypted(): Promise<boolean> {
  const raw = (await chrome.storage.local.get(LOCAL_STORAGE_KEY))[LOCAL_STORAGE_KEY]
  if (typeof raw !== 'string') return false
  const parsed = parseStored(raw)
  return parsed !== null && parsed.v === 1
}

export async function storeEncryptedKey(rawKey: string): Promise<void> {
  const trimmed = rawKey.trim()
  if (!trimmed) {
    await chrome.storage.local.remove(LOCAL_STORAGE_KEY)
    return
  }

  if (!isStrongCryptoAvailable) {
    console.warn('[extension-key-store] subtle unavailable — plain chrome.storage.local')
    await chrome.storage.local.set({
      [LOCAL_STORAGE_KEY]: JSON.stringify({ v: 0, k: trimmed } satisfies StoredPlainV1),
    })
    return
  }

  try {
    const salt = await getOrCreateSessionSaltBytes()
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
    await chrome.storage.local.set({ [LOCAL_STORAGE_KEY]: JSON.stringify(payload) })
  } catch (e) {
    console.warn('[extension-key-store] encrypt failed, plain fallback', e)
    await chrome.storage.local.set({
      [LOCAL_STORAGE_KEY]: JSON.stringify({ v: 0, k: trimmed } satisfies StoredPlainV1),
    })
  }
}

export async function loadEncryptedKey(): Promise<string | null> {
  const raw = (await chrome.storage.local.get(LOCAL_STORAGE_KEY))[LOCAL_STORAGE_KEY]
  if (typeof raw !== 'string') return null
  const parsed = parseStored(raw)
  if (!parsed) return null
  if (parsed.v === 0) return parsed.k
  if (!isStrongCryptoAvailable) return null

  const saltArea = await saltStorage()
  const saltB64 = (await saltArea.get(SESSION_STORAGE_SALT))[SESSION_STORAGE_SALT]
  if (typeof saltB64 !== 'string') return null

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

export async function clearKey(): Promise<void> {
  await chrome.storage.local.remove(LOCAL_STORAGE_KEY)
  const area = await saltStorage()
  await area.remove(SESSION_STORAGE_SALT)
}

export function maskKey(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const prefixes = ['cc_live_', 'cc_sentinel_'] as const
  for (const p of prefixes) {
    if (s.startsWith(p)) {
      const rest = s.slice(p.length)
      if (rest.length <= 8) return rest.length === 0 ? p : `${p}${rest.slice(0, 2)}...`
      return `${p}${rest.slice(0, 4)}...${s.slice(-4)}`
    }
  }
  if (s.length <= 12) return '••••••••'
  return `${s.slice(0, 4)}...${s.slice(-4)}`
}
