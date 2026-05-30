import 'server-only'

import type { ScanV1ApiResponse } from '@/lib/types/institutional-scan-api'

function resolveAppOrigin(): string {
  const u =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.CRYPTOCHECK_BASE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  return u.replace(/\/$/, '')
}

/**
 * Server-side fast scan for `/pro/dashboard` — no direct scanner/sentinel imports.
 * Prefers GET `/api/v1/scan?depth=fast&mint=` (CRON_SECRET); falls back to public POST.
 */
export async function fetchFastScanForMint(mint: string): Promise<ScanV1ApiResponse | null> {
  const base = resolveAppOrigin()
  const secret = process.env.CRON_SECRET?.trim()

  if (secret) {
    const url = `${base}/api/v1/scan?depth=fast&mint=${encodeURIComponent(mint)}`
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${secret}` },
        cache: 'no-store',
      })
      if (res.ok) {
        return (await res.json()) as ScanV1ApiResponse
      }
    } catch (e) {
      console.warn('[pro-dashboard] GET fast scan failed', e instanceof Error ? e.message : e)
    }
  }

  try {
    const res = await fetch(`${base}/api/v1/scan/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress: mint, mint, depth: 'fast' }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as ScanV1ApiResponse
  } catch (e) {
    console.warn('[pro-dashboard] public fast scan failed', e instanceof Error ? e.message : e)
    return null
  }
}
