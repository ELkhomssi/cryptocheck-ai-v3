import 'server-only'

import { randomUUID } from 'crypto'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { PLATFORM_WALLET } from '@/lib/helius'
import { getPaymentIntent } from '@/lib/payments/payment-intent'
import { redis } from '@/lib/cache/redis'
import { scanResultFromAssessment, type RevenueVerdict, type VerifiedBadgeOrder, type VerifiedBadgeSnapshot, type LiveBadgePayload } from '@/lib/revenue-dashboard/types'
import { VERIFIED_BADGE_PRICE_USD, badgeEmbedSnippet } from '@/lib/revenue-dashboard/constants'

export { VERIFIED_BADGE_PRICE_USD, badgeEmbedSnippet }
export type { BadgeOrderStatus, VerifiedBadgeOrder, VerifiedBadgeSnapshot, LiveBadgePayload } from '@/lib/revenue-dashboard/types'

const ORDER_PREFIX = 'ccai:rev:badge:order:'
const MINT_PREFIX = 'ccai:rev:badge:mint:'
const LIVE_PREFIX = 'ccai:rev:badge:live:'
const TTL_SEC = 60 * 60 * 24 * 365
const LIVE_CACHE_SEC = 300

const BADGE_DISCLAIMER =
  'Payment purchases a fresh independent scan and embed rights — it does not influence the verdict. Not financial advice.'

export function badgeMerchantWallet(): string {
  return process.env.VERIFIED_BADGE_MERCHANT_WALLET?.trim() || PLATFORM_WALLET
}

export function badgeReportUrl(mint: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://www.cryptocheckai.com'
  return `${base}/report/${encodeURIComponent(mint)}`
}

export async function createBadgeOrder(mint: string): Promise<VerifiedBadgeOrder> {
  const order: VerifiedBadgeOrder = {
    id: `badge_${randomUUID()}`,
    mint,
    amountUsd: VERIFIED_BADGE_PRICE_USD,
    merchantWallet: badgeMerchantWallet(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  await redis.setex(`${ORDER_PREFIX}${order.id}`, TTL_SEC, JSON.stringify(order))
  return order
}

export async function getBadgeOrder(orderId: string): Promise<VerifiedBadgeOrder | null> {
  try {
    const raw = await redis.get(`${ORDER_PREFIX}${orderId}`)
    return raw ? (JSON.parse(raw) as VerifiedBadgeOrder) : null
  } catch {
    return null
  }
}

async function saveOrder(order: VerifiedBadgeOrder): Promise<void> {
  await redis.setex(`${ORDER_PREFIX}${order.id}`, TTL_SEC, JSON.stringify(order))
}

export async function getBadgeByMint(mint: string): Promise<VerifiedBadgeSnapshot | null> {
  try {
    const raw = await redis.get(`${MINT_PREFIX}${mint}`)
    return raw ? (JSON.parse(raw) as VerifiedBadgeSnapshot) : null
  } catch {
    return null
  }
}

/**
 * After confirmed payment — run gateway scan (verdict independent of payment) and persist badge.
 */
export async function fulfillBadgeOrder(orderId: string, intentId: string): Promise<VerifiedBadgeSnapshot> {
  const order = await getBadgeOrder(orderId)
  if (!order) throw new Error('Badge order not found')
  if (order.status === 'scanned') {
    const existing = await getBadgeByMint(order.mint)
    if (existing) return existing
  }

  const intent = await getPaymentIntent(intentId)
  if (!intent) throw new Error('Payment intent not found')
  if (intent.status !== 'confirmed' && intent.status !== 'submitted') {
    throw new Error(`Payment not confirmed (status: ${intent.status})`)
  }
  if (Math.abs(intent.amountUsd - order.amountUsd) > 0.01) {
    throw new Error('Payment amount does not match badge price')
  }
  if (intent.memo && !intent.memo.includes(orderId)) {
    throw new Error('Payment memo mismatch')
  }

  order.status = 'paid'
  order.intentId = intentId
  order.signature = intent.signature
  order.payerWallet = intent.fromWallet
  order.paidAt = new Date().toISOString()
  await saveOrder(order)

  const assessment = await assessRiskByMint(order.mint, 'solana', 'fast')
  const scan = scanResultFromAssessment(order.mint, assessment)

  const snapshot: VerifiedBadgeSnapshot = {
    mint: order.mint,
    orderId: order.id,
    safetyScore: scan.safetyScore,
    riskScore: scan.riskScore,
    verdict: scan.verdict,
    paidAt: order.paidAt,
    scannedAt: scan.scannedAt,
    reportUrl: badgeReportUrl(order.mint),
    payerWallet: order.payerWallet,
    paymentSignature: order.signature,
  }

  order.status = 'scanned'
  order.scannedAt = snapshot.scannedAt
  await saveOrder(order)
  await redis.setex(`${MINT_PREFIX}${order.mint}`, TTL_SEC, JSON.stringify(snapshot))
  await redis.setex(`${LIVE_PREFIX}${order.mint}`, LIVE_CACHE_SEC, JSON.stringify(snapshot))

  return snapshot
}

/** Live verdict for embed — refreshes from gateway when badge is paid; never pay-to-pass. */
export async function getLiveBadgePayload(mint: string): Promise<LiveBadgePayload | null> {
  const paid = await getBadgeByMint(mint)
  if (!paid) return null

  try {
    const cached = await redis.get(`${LIVE_PREFIX}${mint}`)
    if (cached) {
      const snap = JSON.parse(cached) as VerifiedBadgeSnapshot
      return {
        mint,
        paid: true,
        safetyScore: snap.safetyScore,
        riskScore: snap.riskScore,
        verdict: snap.verdict,
        scannedAt: snap.scannedAt,
        reportUrl: snap.reportUrl,
        disclaimer: BADGE_DISCLAIMER,
      }
    }
  } catch {
    /* refresh */
  }

  const assessment = await assessRiskByMint(mint, 'solana', 'fast')
  const scan = scanResultFromAssessment(mint, assessment)
  const snap: VerifiedBadgeSnapshot = {
    ...paid,
    safetyScore: scan.safetyScore,
    riskScore: scan.riskScore,
    verdict: scan.verdict,
    scannedAt: scan.scannedAt,
  }
  await redis.setex(`${MINT_PREFIX}${mint}`, TTL_SEC, JSON.stringify(snap))
  await redis.setex(`${LIVE_PREFIX}${mint}`, LIVE_CACHE_SEC, JSON.stringify(snap))

  return {
    mint,
    paid: true,
    safetyScore: scan.safetyScore,
    riskScore: scan.riskScore,
    verdict: scan.verdict,
    scannedAt: scan.scannedAt,
    reportUrl: badgeReportUrl(mint),
    disclaimer: BADGE_DISCLAIMER,
  }
}

export function verdictColor(verdict: RevenueVerdict): string {
  if (verdict === 'SAFE') return '#3FE05A'
  if (verdict === 'CAUTION') return '#F2B84C'
  return '#FF5A6E'
}
