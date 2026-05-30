import 'server-only'

import { redis } from '@/lib/cache/redis'

export interface MerchantProfile {
  walletAddress: string
  merchantName: string
  webhookUrl?: string
  chain: string
  createdAt: string
}

const MERCHANT_PREFIX = 'ccai:merchant:'
const MERCHANT_TTL_SEC = 60 * 60 * 24 * 90 // 90 days

function merchantKey(wallet: string): string {
  return `${MERCHANT_PREFIX}${wallet}`
}

export async function saveMerchant(profile: MerchantProfile): Promise<void> {
  await redis.setex(merchantKey(profile.walletAddress), MERCHANT_TTL_SEC, JSON.stringify(profile))
}

export async function getMerchant(wallet: string): Promise<MerchantProfile | null> {
  try {
    const raw = await redis.get(merchantKey(wallet))
    if (!raw) return null
    return JSON.parse(raw) as MerchantProfile
  } catch {
    return null
  }
}
