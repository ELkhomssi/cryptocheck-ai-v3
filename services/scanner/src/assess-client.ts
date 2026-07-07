/**
 * Thin client for the frozen risk core over HTTP.
 * Mirrors services/pipeline/src/enrich/assess-client.ts — the ONLY sanctioned
 * way to obtain an authoritative token score outside the Next.js app
 * (token scans go through lib/connect/scan-gateway.ts → assessRiskByMint).
 */
import type { SentinelVerdict } from '@cryptocheck/signal-contracts'

export type GatewayAssess = {
  resolved: boolean
  dropped: boolean
  dropReason?: string
  sentinelVerdict?: SentinelVerdict
  gatewayVerdict?: 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'BLOCKED'
  neuralScore?: number
  riskScore?: number
  evidenceSummary?: string
  cache?: 'hit' | 'miss'
  /** true when the HTTP call itself failed (distinct from a resolved drop). */
  transportError?: boolean
}

export async function assessViaGateway(
  assessUrl: string,
  workerSecret: string,
  mint: string,
  timeoutMs = 3_000,
): Promise<GatewayAssess> {
  if (!workerSecret) {
    return { resolved: false, dropped: true, dropReason: 'SIGNAL_WORKER_SECRET not configured', transportError: true }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(assessUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({ chain: 'solana', contractAddress: mint }),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!res.ok) {
      return { resolved: false, dropped: true, dropReason: `assess HTTP ${res.status}`, transportError: true }
    }
    return (await res.json()) as GatewayAssess
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return {
      resolved: false,
      dropped: true,
      dropReason: aborted ? `assess timeout (${timeoutMs}ms)` : e instanceof Error ? e.message : 'assess failed',
      transportError: true,
    }
  } finally {
    clearTimeout(timer)
  }
}
