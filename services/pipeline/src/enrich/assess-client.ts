import type { SignalChain, SentinelVerdict } from '@cryptocheck/signal-contracts'

export type AssessResult = {
  resolved: boolean
  dropped: boolean
  dropReason?: string
  sentinelVerdict?: SentinelVerdict
  neuralScore?: number
  riskScore?: number
  evidenceSummary?: string
}

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

  const res = await fetch(`${baseUrl}/api/internal/signals/assess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ chain, contractAddress }),
  })

  const body = (await res.json().catch(() => ({}))) as AssessResult & { error?: string }
  if (!res.ok) {
    return { resolved: false, dropped: true, dropReason: body.error ?? `HTTP ${res.status}` }
  }

  return body
}
