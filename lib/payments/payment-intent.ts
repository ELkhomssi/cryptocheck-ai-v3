import 'server-only'

import { randomUUID } from 'crypto'
import { Redis } from '@upstash/redis'
import { redis } from '@/lib/cache/redis'
import { getSolanaConnection } from '@/lib/solana/connection'
import { assessRecipient } from '@/lib/payments/recipient-risk'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { getMerchant } from '@/lib/payments/merchant'
import { deliverPartnerWebhook } from '@/lib/b2b/webhook-delivery'

export type PaymentStatus =
  | 'pending_risk_check'
  | 'risk_approved'
  | 'risk_blocked'
  | 'pending_signature'
  | 'submitted'
  | 'confirmed'
  | 'failed'

export interface PaymentRiskAssessment {
  score: number
  recipientVerified: boolean
  tokenRisk: number
  amountRiskFlag: boolean
  approved: boolean
  blockedReason?: string
}

export interface PaymentIntent {
  id: string
  fromWallet: string
  toWallet: string
  toMerchant?: string
  amountUsd: number
  tokenMint: string
  chain: 'solana' | 'ethereum' | 'base'
  memo?: string
  expiresAt: string
  status: PaymentStatus
  riskAssessment?: PaymentRiskAssessment
  signature?: string
}

const PAYMENT_PREFIX = 'ccai:payment:'
const PAYMENT_TTL_SEC = 900 // 15 minutes
const AMOUNT_FLAG_USD = 5000
const TOKEN_BLOCK_RISK = 80

function listRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return Redis.fromEnv()
}

function intentKey(id: string): string {
  return `${PAYMENT_PREFIX}${id}`
}

async function storeIntent(intent: PaymentIntent): Promise<void> {
  const ttl = Math.max(1, Math.ceil((new Date(intent.expiresAt).getTime() - Date.now()) / 1000))
  await redis.setex(intentKey(intent.id), Math.min(PAYMENT_TTL_SEC, ttl), JSON.stringify(intent))
}

export async function getPaymentIntent(id: string): Promise<PaymentIntent | null> {
  try {
    const raw = await redis.get(intentKey(id))
    if (!raw) return null
    return JSON.parse(raw) as PaymentIntent
  } catch {
    return null
  }
}

export async function createPaymentIntent(
  params: Omit<PaymentIntent, 'id' | 'status' | 'expiresAt' | 'riskAssessment' | 'signature'>
): Promise<PaymentIntent> {
  const id = `pi_${randomUUID()}`
  const expiresAt = new Date(Date.now() + PAYMENT_TTL_SEC * 1000).toISOString()
  const chain = params.chain

  const merchant = await getMerchant(params.toWallet).catch(() => null)

  const [recipient, tokenRisk] = await Promise.all([
    assessRecipient(params.toWallet, chain),
    assessRiskByMint(params.tokenMint, chain === 'solana' ? 'solana' : 'solana', 'fast').catch(() => null),
  ])

  const tokenRiskScore = tokenRisk?.riskScore ?? 0
  const amountRiskFlag = params.amountUsd > AMOUNT_FLAG_USD

  let approved = recipient.approved && tokenRiskScore < TOKEN_BLOCK_RISK
  let blockedReason: string | undefined
  if (recipient.riskLevel === 'blacklisted') {
    approved = false
    blockedReason = 'Recipient wallet is blacklisted.'
  } else if (recipient.riskLevel === 'flagged') {
    approved = false
    blockedReason = 'Recipient wallet is flagged as high-risk.'
  } else if (tokenRiskScore >= TOKEN_BLOCK_RISK) {
    approved = false
    blockedReason = `Payment token risk score ${tokenRiskScore}/100 is too high.`
  }

  const riskAssessment: PaymentRiskAssessment = {
    score: tokenRiskScore,
    recipientVerified: recipient.verified,
    tokenRisk: tokenRiskScore,
    amountRiskFlag,
    approved,
    blockedReason,
  }

  const intent: PaymentIntent = {
    id,
    fromWallet: params.fromWallet,
    toWallet: params.toWallet,
    toMerchant: merchant?.merchantName ?? params.toMerchant,
    amountUsd: params.amountUsd,
    tokenMint: params.tokenMint,
    chain,
    memo: params.memo,
    expiresAt,
    status: approved ? 'risk_approved' : 'risk_blocked',
    riskAssessment,
  }

  await storeIntent(intent)
  return intent
}

function isExpired(intent: PaymentIntent): boolean {
  return new Date(intent.expiresAt).getTime() <= Date.now()
}

export async function confirmPaymentIntent(
  intentId: string,
  signedTransaction: string
): Promise<{ signature: string; status: 'confirmed' | 'failed' }> {
  const intent = await getPaymentIntent(intentId)
  if (!intent) throw new Error('Payment intent not found or expired.')
  if (isExpired(intent)) throw new Error('Payment intent has expired.')
  if (intent.status !== 'risk_approved') {
    throw new Error(`Payment intent is not approved (status: ${intent.status}).`)
  }

  const connection = getSolanaConnection()
  let signature = ''
  let status: 'confirmed' | 'failed' = 'failed'
  try {
    const raw = Buffer.from(signedTransaction, 'base64')
    signature = await connection.sendRawTransaction(new Uint8Array(raw), { skipPreflight: false })
    intent.signature = signature
    intent.status = 'submitted'
    await storeIntent(intent)

    const conf = await connection.confirmTransaction(signature, 'confirmed')
    status = conf.value.err ? 'failed' : 'confirmed'
  } catch (e) {
    intent.status = 'failed'
    await storeIntent(intent)
    throw e instanceof Error ? e : new Error('Payment submission failed')
  }

  intent.status = status
  await storeIntent(intent)
  await recordMerchantPayment(intent).catch(() => {})
  if (status === 'confirmed') void notifyMerchant(intent)

  return { signature, status }
}

async function recordMerchantPayment(intent: PaymentIntent): Promise<void> {
  const r = listRedis()
  if (!r) return
  const key = `ccai:merchant:payments:${intent.toWallet}`
  await r.lpush(
    key,
    JSON.stringify({
      id: intent.id,
      fromWallet: intent.fromWallet,
      amountUsd: intent.amountUsd,
      tokenMint: intent.tokenMint,
      status: intent.status,
      riskScore: intent.riskAssessment?.score ?? null,
      signature: intent.signature ?? null,
      at: new Date().toISOString(),
    })
  )
  await r.ltrim(key, 0, 199)
  await r.expire(key, 60 * 60 * 24 * 90)
}

export type MerchantPaymentRow = {
  id: string
  fromWallet: string
  amountUsd: number
  tokenMint: string
  status: PaymentStatus
  riskScore: number | null
  signature: string | null
  at: string
}

export async function listMerchantPayments(wallet: string, limit = 50): Promise<MerchantPaymentRow[]> {
  const r = listRedis()
  if (!r) return []
  try {
    const rows = await r.lrange<string>(`ccai:merchant:payments:${wallet}`, 0, limit - 1)
    return (rows ?? [])
      .map((raw) => {
        try {
          return typeof raw === 'string' ? (JSON.parse(raw) as MerchantPaymentRow) : (raw as MerchantPaymentRow)
        } catch {
          return null
        }
      })
      .filter(Boolean) as MerchantPaymentRow[]
  } catch {
    return []
  }
}

async function notifyMerchant(intent: PaymentIntent): Promise<void> {
  const merchant = await getMerchant(intent.toWallet).catch(() => null)
  if (!merchant?.webhookUrl) return
  deliverPartnerWebhook(merchant.webhookUrl, {
    event: 'risk.assessed',
    partnerId: intent.toWallet,
    payload: {
      type: 'payment.confirmed',
      intentId: intent.id,
      amountUsd: intent.amountUsd,
      tokenMint: intent.tokenMint,
      signature: intent.signature,
      riskScore: intent.riskAssessment?.score ?? null,
    },
  })
}
