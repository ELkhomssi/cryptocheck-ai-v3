/**
 * Capital management — Redis-backed exposure book (ccai:rev:exec:*).
 * Critical risk category is never executable.
 */
import 'server-only'

import { redis } from '@/lib/cache/redis'
import type { CapitalCheckResult, CapitalPolicy, OpportunityIntake } from './types'
import { DEFAULT_CAPITAL_POLICY } from './types'

const DAY_SEC = 86_400

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function exposureTokenKey(userId: string, mint: string): string {
  return `ccai:rev:exec:exp:token:${userId}:${mint}`
}

function exposureWalletKey(userId: string, wallet: string): string {
  return `ccai:rev:exec:exp:wallet:${userId}:${wallet}`
}

function dailyPnlKey(userId: string): string {
  return `ccai:rev:exec:pnl:day:${userId}:${dayKey()}`
}

function openPosKey(userId: string): string {
  return `ccai:rev:exec:open:${userId}`
}

async function getFloat(key: string): Promise<number> {
  const raw = await redis.get(key)
  const n = Number(raw ?? 0)
  return Number.isFinite(n) ? n : 0
}

async function setFloat(key: string, value: number, ttlSec: number): Promise<void> {
  await redis.setex(key, ttlSec, String(value))
}

export async function loadCapitalPolicy(userId: string): Promise<CapitalPolicy> {
  const raw = await redis.get(`ccai:rev:exec:policy:${userId}`)
  if (!raw) return { ...DEFAULT_CAPITAL_POLICY }
  try {
    return { ...DEFAULT_CAPITAL_POLICY, ...(JSON.parse(raw) as Partial<CapitalPolicy>), blockCritical: true }
  } catch {
    return { ...DEFAULT_CAPITAL_POLICY }
  }
}

export async function checkCapitalLimits(
  opp: OpportunityIntake,
  policy: CapitalPolicy,
): Promise<CapitalCheckResult> {
  const amount = opp.amountSol ?? 0
  const [currentExposureTokenSol, currentExposureWalletSol, dailyPnlSol, openPositions] =
    await Promise.all([
      getFloat(exposureTokenKey(opp.userId, opp.mint)),
      getFloat(exposureWalletKey(opp.userId, opp.walletAddress)),
      getFloat(dailyPnlKey(opp.userId)),
      getFloat(openPosKey(opp.userId)),
    ])

  const reasons: string[] = []
  if (amount > policy.maxSolPerTrade) {
    reasons.push(`Trade ${amount} SOL exceeds maxSolPerTrade ${policy.maxSolPerTrade}`)
  }
  if (currentExposureTokenSol + amount > policy.maxExposurePerTokenSol) {
    reasons.push(`Token exposure would exceed ${policy.maxExposurePerTokenSol} SOL`)
  }
  if (currentExposureWalletSol + amount > policy.maxExposurePerWalletSol) {
    reasons.push(`Wallet exposure would exceed ${policy.maxExposurePerWalletSol} SOL`)
  }
  if (dailyPnlSol < -Math.abs(policy.maxDailyLossSol)) {
    reasons.push(`Daily loss limit hit (${dailyPnlSol} SOL)`)
  }
  if (openPositions >= policy.maxSimultaneousPositions) {
    reasons.push(`Max simultaneous positions (${policy.maxSimultaneousPositions})`)
  }
  if (opp.maxSlippageBps > policy.maxSlippageBps) {
    reasons.push(`Slippage ${opp.maxSlippageBps} bps > policy ${policy.maxSlippageBps}`)
  }

  return {
    ok: reasons.length === 0,
    policy,
    reasons,
    currentExposureTokenSol,
    currentExposureWalletSol,
    dailyPnlSol,
    openPositions,
  }
}

export async function recordCapitalFill(
  opp: OpportunityIntake,
  _signature: string,
  pnlSolDelta: number,
): Promise<void> {
  const amount = opp.amountSol ?? 0
  const tokenKey = exposureTokenKey(opp.userId, opp.mint)
  const walletKey = exposureWalletKey(opp.userId, opp.walletAddress)
  const pnlKey = dailyPnlKey(opp.userId)
  const openKey = openPosKey(opp.userId)

  const [token, wallet, pnl, open] = await Promise.all([
    getFloat(tokenKey),
    getFloat(walletKey),
    getFloat(pnlKey),
    getFloat(openKey),
  ])

  const nextOpen =
    opp.side === 'buy' ? open + 1 : opp.side === 'sell' ? Math.max(0, open - 1) : open

  await Promise.all([
    setFloat(tokenKey, token + amount, DAY_SEC * 7),
    setFloat(walletKey, wallet + amount, DAY_SEC * 7),
    setFloat(pnlKey, pnl + pnlSolDelta, DAY_SEC * 2),
    setFloat(openKey, nextOpen, DAY_SEC * 7),
  ])
}
