/**
 * Shared API client — always sends Authorization: Bearer for CryptoCheck routes.
 * Base URL targets production; override via Vite env in dev if needed.
 */
const DEFAULT_ORIGIN = 'https://www.cryptocheckai.com'

export function getApiOrigin(): string {
  return import.meta.env.VITE_CRYPTOCHECK_ORIGIN?.trim() || DEFAULT_ORIGIN
}

export type ApiFetchInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
  rawKey?: string | null
}

export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const origin = getApiOrigin()
  const url = path.startsWith('http') ? path : `${origin.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  }
  const key = init.rawKey?.trim()
  if (key) {
    headers.Authorization = `Bearer ${key}`
  }
  const { rawKey: _k, ...rest } = init
  return fetch(url, { ...rest, headers })
}
