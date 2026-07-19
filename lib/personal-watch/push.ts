import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveSignalTier } from '@/lib/signal-aggregator/subscription'
import type { WatchDegradeEvent } from './constants'

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

/**
 * Push WatchDegradeEvent via the same VAPID + signal_push_subscription pipeline.
 * Premium-gated (same as SAFE signal pushes). Deep-links Action Panel with mint.
 */
export async function dispatchWatchDegradePush(event: WatchDegradeEvent): Promise<{ sent: number }> {
  const tier = await resolveSignalTier({ userId: event.userId })
  if (tier !== 'premium') return { sent: 0 }

  const sb = getSupabaseAdmin()
  const { data: subs } = await sb
    .from('signal_push_subscription')
    .select('endpoint, p256dh, auth')
    .eq('user_id', event.userId)

  if (!subs?.length) return { sent: 0 }

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://www.cryptocheckai.com'
  const deepLink = `${base}/dashboard?mint=${encodeURIComponent(event.mint)}&mode=${event.held ? 'swap' : 'scan'}&coachAlert=${encodeURIComponent(event.id)}#action-panel`

  const payload = JSON.stringify({
    title: `Watch alert · ${event.newVerdict}`,
    body: `${event.mint.slice(0, 4)}…${event.mint.slice(-4)}: ${event.reason}`,
    url: deepLink,
    type: 'watch_degrade',
    eventId: event.id,
    mint: event.mint,
  })

  let sent = 0
  for (const sub of subs) {
    try {
      await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      )
      sent += 1
    } catch {
      /* expired */
    }
  }
  return { sent }
}
