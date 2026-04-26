/**
 * Platform-wide CryptoCheck AI customer API key (`cc_live_…`, `cc_sentinel_2_…`).
 * Used by Pro dashboard, Investigate, and the Analysis Console (neural terminal) so one unlock applies everywhere.
 */
export const CRYPTOCHECK_ACCESS_KEY_STORAGE = 'cryptocheck_access_key'

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
}

export function clearCryptocheckAccessKeyFromLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CRYPTOCHECK_ACCESS_KEY_STORAGE)
  } catch {
    /* ignore */
  }
}
