import type { SignalChain, SentinelVerdict } from '@cryptocheck/signal-contracts'

export type AssessResult = {
  resolved: boolean
  dropped: boolean
  dropReason?: string
  enrichmentDegraded?: boolean
  sentinelVerdict?: SentinelVerdict
  neuralScore?: number
  riskScore?: number
  evidenceSummary?: string
}

const ASSESS_TIMEOUT_MS = Number(process.env.SIGNAL_ASSESS_TIMEOUT_MS ?? 25_000)
const ASSESS_RETRIES = Math.max(0, Number(process.env.SIGNAL_ASSESS_RETRIES ?? 2))

async function fetchAssessOnce(
  url: string,
  secret: string,
  chain: SignalChain,
  contractAddress: string,
): Promise<AssessResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ASSESS_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ chain, contractAddress }),
      signal: ctrl.signal,
    })

    const body = (await res.json().catch(() => ({}))) as AssessResult & { error?: string }
    if (!res.ok) {
      // 5xx → transient (keep scanning); 4xx → hard drop
      const transient = res.status >= 500
      return {
        resolved: false,
        dropped: !transient,
        dropReason: body.error ?? `HTTP ${res.status}`,
      }
    }
    return body
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return {
      resolved: false,
      dropped: false,
      dropReason: aborted
        ? `Assess timeout after ${ASSESS_TIMEOUT_MS}ms`
        : e instanceof Error
          ? e.message
          : 'Assess network error',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Call Vercel `/api/internal/signals/assess` with timeout + retries.
 * Transient failures return `dropped: false` so the gate keeps the scanning row.
 */
export async function assessContract(
  chain: SignalChain,
  contractAddress: string,
): Promise<AssessResult> {
  const baseUrl = (
    process.env.SIGNAL_ASSESS_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/$/, '')

  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''

  if (!secret) {
    return { resolved: false, dropped: true, dropReason: 'SIGNAL_WORKER_SECRET not configured' }
  }

  const url = `${baseUrl}/api/internal/signals/assess`
  let last: AssessResult = {
    resolved: false,
    dropped: false,
    dropReason: 'Assess not attempted',
  }

  for (let attempt = 0; attempt <= ASSESS_RETRIES; attempt++) {
    last = await fetchAssessOnce(url, secret, chain, contractAddress)
    if (last.resolved || last.dropped) return last
    if (attempt < ASSESS_RETRIES) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }

  return last
}
