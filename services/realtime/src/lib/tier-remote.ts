import type { SignalSubscriptionTier } from '@cryptocheck/signal-contracts'

/** Resolve tier via Next.js internal API (workers cannot import @/). */
export async function resolveTierRemote(opts: {
  userId?: string
  bearerToken?: string
}): Promise<SignalSubscriptionTier> {
  const devToken = process.env.SIGNAL_PREMIUM_TOKEN?.trim()
  if (devToken && opts.bearerToken === devToken) return 'premium'

  if (!opts.userId) return 'free'

  const baseUrl = (
    process.env.SIGNAL_ASSESS_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/$/, '')

  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  if (!secret) return 'free'

  try {
    const res = await fetch(
      `${baseUrl}/api/internal/signals/tier?userId=${encodeURIComponent(opts.userId)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        cache: 'no-store',
      },
    )
    const body = (await res.json()) as { tier?: SignalSubscriptionTier }
    return body.tier === 'premium' ? 'premium' : 'free'
  } catch {
    return 'free'
  }
}
