/**
 * Platform-wide CryptoCheck AI customer API key (`cc_live_…`, `cc_sentinel_2_…`).
 *
 * **Source of truth:** `cryptocheck_access_key` in `localStorage`. Other legacy blobs
 * are migrated into this key on read (see `loadAccessKeyMaterial` in client-key-store).
 */
export const CRYPTOCHECK_ACCESS_KEY_STORAGE = 'cryptocheck_access_key'

/** Fired after flat `cryptocheck_access_key` changes so UI can refresh diagnostics site-wide. */
export const CRYPTOCHECK_ACCESS_KEY_SYSTEM_EVENT = 'cryptocheck-access-key-system-changed'

function emitAccessKeySystemChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(CRYPTOCHECK_ACCESS_KEY_SYSTEM_EVENT))
  } catch {
    /* ignore */
  }
}

export function readCryptocheckAccessKeyFromLocalStorage(): string {
  if (typeof window === 'undefined') return ''
  try {
    return (window.localStorage.getItem(CRYPTOCHECK_ACCESS_KEY_STORAGE) ?? '').trim()
  } catch {
    return ''
  }
}

export function writeCryptocheckAccessKeyToLocalStorage(raw: string): void {
  if (typeof window === 'undefined') return
  const t = raw.trim()
  if (!t) {
    clearCryptocheckAccessKeyFromLocalStorage()
    return
  }
  try {
    window.localStorage.setItem(CRYPTOCHECK_ACCESS_KEY_STORAGE, t)
  } catch {
    /* ignore */
  }
  emitAccessKeySystemChanged()
}

export function clearCryptocheckAccessKeyFromLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CRYPTOCHECK_ACCESS_KEY_STORAGE)
  } catch {
    /* ignore */
  }
  emitAccessKeySystemChanged()
}
