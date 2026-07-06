import type { NormalizedSignal } from '@cryptocheck/signal-contracts'

export async function dispatchSafeSignalPush(signal: NormalizedSignal): Promise<void> {
  if (signal.sentinelVerdict !== 'safe' || signal.dropped || signal.sample) return

  const baseUrl = (
    process.env.SIGNAL_ASSESS_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/$/, '')

  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  if (!secret) return

  try {
    await fetch(`${baseUrl}/api/internal/signals/push-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ signal }),
    })
  } catch {
    /* best-effort */
  }
}
