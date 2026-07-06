import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveConsumerTier } from '@/lib/billing/consumer-tier'
import { PLATFORM_WALLET } from '@/lib/helius'
import { getPaymentIntent } from '@/lib/payments/payment-intent'
import type { SignalSubscriptionTier } from '@cryptocheck/signal-contracts'

export const SIGNAL_PREMIUM_PRICE_USD = Number(process.env.SIGNAL_PREMIUM_PRICE_USD ?? 29)
export const SIGNAL_PREMIUM_DAYS = Number(process.env.SIGNAL_PREMIUM_DAYS ?? 30)

export function signalPremiumMerchantWallet(): string {
  return process.env.SIGNAL_PREMIUM_MERCHANT_WALLET?.trim() || PLATFORM_WALLET
}

function consumerIsPremium(tier: string): boolean {
  return tier === 'pro' || tier === 'elite' || tier === 'enterprise' || tier === 'micropack'
}

/** Server-side tier resolution — used by APIs and internal worker bridge. */
export async function resolveSignalTier(opts: {
  userId?: string
  bearerToken?: string
}): Promise<SignalSubscriptionTier> {
  const devToken = process.env.SIGNAL_PREMIUM_TOKEN?.trim()
  if (devToken && opts.bearerToken === devToken) return 'premium'

  if (!opts.userId) return 'free'

  try {
    const consumer = await resolveConsumerTier(opts.userId)
    if (consumerIsPremium(consumer)) return 'premium'
  } catch {
    /* continue */
  }

  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from('signal_subscription')
    .select('tier, premium_until')
    .eq('user_id', opts.userId)
    .maybeSingle()

  if (data?.tier === 'premium') {
    if (!data.premium_until || new Date(data.premium_until) > new Date()) return 'premium'
  }

  return 'free'
}

export async function upsertSignalPremium(userId: string, days = SIGNAL_PREMIUM_DAYS): Promise<void> {
  const until = new Date()
  until.setDate(until.getDate() + days)
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('signal_subscription').upsert(
    {
      user_id: userId,
      tier: 'premium',
      premium_until: until.toISOString(),
      push_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
}

export async function fulfillSignalPremiumPayment(
  userId: string,
  intentId: string,
): Promise<void> {
  const intent = await getPaymentIntent(intentId)
  if (!intent) throw new Error('Payment intent not found')
  if (intent.status !== 'confirmed' && intent.status !== 'submitted') {
    throw new Error(`Payment not confirmed (${intent.status})`)
  }
  if (Math.abs(intent.amountUsd - SIGNAL_PREMIUM_PRICE_USD) > 0.5) {
    throw new Error('Payment amount mismatch')
  }
  if (intent.memo && !intent.memo.includes(userId)) {
    throw new Error('Payment memo mismatch')
  }
  await upsertSignalPremium(userId)
}

export type PushSubscriptionRow = {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('signal_push_subscription').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
}

export async function listPremiumPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const sb = getSupabaseAdmin()
  const { data: subs } = await sb.from('signal_push_subscription').select('user_id, endpoint, p256dh, auth')
  if (!subs?.length) return []

  const premiumUsers = new Set<string>()
  for (const row of subs) {
    const tier = await resolveSignalTier({ userId: row.user_id as string })
    if (tier === 'premium') premiumUsers.add(row.user_id as string)
  }

  return (subs as PushSubscriptionRow[]).filter((s) => premiumUsers.has(s.user_id))
}
