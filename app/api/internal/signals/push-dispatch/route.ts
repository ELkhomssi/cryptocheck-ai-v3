import { NextRequest, NextResponse } from 'next/server'
import type { NormalizedSignal } from '@cryptocheck/signal-contracts'
import { SIGNAL_FEED_BASE_PATH } from '@/lib/signal-aggregator/constants'
import { listPremiumPushSubscriptions } from '@/lib/signal-aggregator/subscription'

export const dynamic = 'force-dynamic'

function assertWorker(req: NextRequest): boolean {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  return Boolean(secret && header === secret)
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<void> {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@cryptocheckai.com'

  if (!publicKey || !privateKey) return

  const webpush = await import('web-push')
  webpush.setVapidDetails(subject, publicKey, privateKey)
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    payload,
  )
}

/** POST /api/internal/signals/push-dispatch — premium SAFE alert (worker only). */
export async function POST(req: NextRequest) {
  if (!assertWorker(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { signal?: NormalizedSignal }
  const signal = body.signal
  if (!signal?.id || signal.sentinelVerdict !== 'safe' || signal.dropped) {
    return NextResponse.json({ skipped: true })
  }

  const subs = await listPremiumPushSubscriptions()
  if (!subs.length) return NextResponse.json({ sent: 0 })

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://www.cryptocheckai.com'
  const deepLink = `${base}${SIGNAL_FEED_BASE_PATH}?signalId=${encodeURIComponent(signal.id)}&mint=${encodeURIComponent(signal.contractAddress)}`

  const payload = JSON.stringify({
    title: `SAFE · ${signal.tokenSymbol}`,
    body: `${signal.sourceCount} ch · score ${signal.neuralScore ?? '—'}`,
    url: deepLink,
  })

  let sent = 0
  for (const sub of subs) {
    try {
      await sendWebPush(sub, payload)
      sent += 1
    } catch {
      /* expired subscription — ignore */
    }
  }

  return NextResponse.json({ sent })
}
