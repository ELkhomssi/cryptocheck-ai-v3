import type { TxOddsIngestionConfig } from '../config.js'

export type TxOddsCredentials = {
  apiOrigin: string
  jwt: string
  apiToken: string
}

export async function fetchGuestJwt(apiOrigin: string): Promise<string> {
  const res = await fetch(`${apiOrigin}/auth/guest/start`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TxLINE guest auth failed (${res.status}): ${body || res.statusText}`)
  }
  const json = (await res.json()) as { token?: string }
  const jwt = json.token?.trim()
  if (!jwt) throw new Error('TxLINE guest auth returned no token')
  return jwt
}

export async function resolveTxOddsCredentials(
  config: TxOddsIngestionConfig,
): Promise<TxOddsCredentials> {
  const apiToken = config.apiToken.trim()
  if (!apiToken) {
    throw new Error('TXLINE_API_TOKEN is required for TxODDS streams')
  }

  const jwt = config.jwt?.trim() ? config.jwt.trim() : await fetchGuestJwt(config.apiOrigin)

  return {
    apiOrigin: config.apiOrigin,
    jwt,
    apiToken,
  }
}

export function txOddsAuthHeaders(creds: TxOddsCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.jwt}`,
    'X-Api-Token': creds.apiToken,
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  }
}

export function txOddsJsonHeaders(creds: TxOddsCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.jwt}`,
    'X-Api-Token': creds.apiToken,
    'Content-Type': 'application/json',
  }
}
