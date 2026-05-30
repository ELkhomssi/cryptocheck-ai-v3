import 'server-only'

import { redis } from '@/lib/cache/redis'
import { fetchWalletHoldings } from '@/lib/helius/fetch-wallet-holdings'
import { mapWithConcurrency } from '@/lib/concurrency/pool'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'

export interface PortfolioPosition {
  mint: string
  chain: string
  symbol: string
  amountTokens: number
  avgEntryPriceUsd: number
  currentPriceUsd: number
  valueUsd: number
  pnlUsd: number
  pnlPct: number
  riskScore: number
  riskDelta: number
  warnings: string[]
  estimated: boolean
}

export type RiskExposure = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Portfolio {
  walletAddress: string
  chain: string
  totalValueUsd: number
  totalPnlUsd: number
  totalPnlPct: number
  riskExposure: RiskExposure
  positions: PortfolioPosition[]
  lastUpdatedAt: string
}

type EntryRecord = { avgEntryPriceUsd: number; entryRiskScore: number; amountTokens: number; updatedAt: string }

const MIN_VALUE_USD = 1
const SCAN_CONCURRENCY = 10
const POSITION_PREFIX = 'ccai:position:'
const SNAPSHOT_PREFIX = 'ccai:portfolio:snap:'

function positionKey(wallet: string, mint: string): string {
  return `${POSITION_PREFIX}${wallet}:${mint}`
}

/** Records an entry position (call from the swap flow when a buy executes via the platform). */
export async function recordEntryPosition(
  wallet: string,
  mint: string,
  entry: { priceUsd: number; riskScore: number; amountTokens: number }
): Promise<void> {
  const rec: EntryRecord = {
    avgEntryPriceUsd: entry.priceUsd,
    entryRiskScore: entry.riskScore,
    amountTokens: entry.amountTokens,
    updatedAt: new Date().toISOString(),
  }
  await redis.setex(positionKey(wallet, mint), 60 * 60 * 24 * 180, JSON.stringify(rec))
}

async function readEntry(wallet: string, mint: string): Promise<EntryRecord | null> {
  try {
    const raw = await redis.get(positionKey(wallet, mint))
    return raw ? (JSON.parse(raw) as EntryRecord) : null
  } catch {
    return null
  }
}

const FLAG_WARNING: Record<string, string> = {
  missing_liquidity: 'Liquidity unavailable',
  thin_liquidity: 'Thin liquidity',
  mint_authority_active: 'Mint authority active',
  freeze_authority_active: 'Freeze authority active',
  lp_unlocked: 'LP unlocked',
  mixer_funding_trail: 'Mixer funding trail',
  new_pair: 'New pair (<24h)',
}

function flagsToWarnings(flags: string[]): string[] {
  return flags.map((f) => FLAG_WARNING[f]).filter(Boolean) as string[]
}

function computeExposure(positions: PortfolioPosition[]): RiskExposure {
  if (positions.some((p) => p.riskScore >= 80)) return 'CRITICAL'
  const totalValue = positions.reduce((a, p) => a + p.valueUsd, 0)
  const riskyValue = positions.filter((p) => p.riskScore > 50).reduce((a, p) => a + p.valueUsd, 0)
  if (positions.some((p) => p.riskScore > 60) || (totalValue > 0 && riskyValue / totalValue > 0.3)) return 'HIGH'
  if (positions.some((p) => p.riskScore > 40)) return 'MEDIUM'
  return 'LOW'
}

export type PortfolioSnapshot = {
  exposure: RiskExposure
  positions: Array<{ mint: string; riskScore: number }>
  at: string
}

export async function readPortfolioSnapshot(wallet: string, chain: string): Promise<PortfolioSnapshot | null> {
  try {
    const raw = await redis.get(`${SNAPSHOT_PREFIX}${wallet}:${chain}`)
    return raw ? (JSON.parse(raw) as PortfolioSnapshot) : null
  } catch {
    return null
  }
}

async function writeSnapshot(portfolio: Portfolio): Promise<void> {
  try {
    await redis.setex(
      `${SNAPSHOT_PREFIX}${portfolio.walletAddress}:${portfolio.chain}`,
      60 * 60 * 24,
      JSON.stringify({
        exposure: portfolio.riskExposure,
        positions: portfolio.positions.map((p) => ({ mint: p.mint, riskScore: p.riskScore })),
        at: portfolio.lastUpdatedAt,
      })
    )
  } catch {
    /* best-effort */
  }
}

/**
 * Builds a portfolio with per-position risk scores and P&L.
 * Batches risk scans (≤10 concurrent) to avoid hammering upstreams.
 */
export async function getPortfolio(walletAddress: string, chain = 'solana'): Promise<Portfolio> {
  const holdings = await fetchWalletHoldings(walletAddress, { maxTokens: 50 }).catch(() => [])
  const tradable = holdings.filter((h) => (h.valueUsd ?? 0) >= MIN_VALUE_USD)

  const positions = await mapWithConcurrency(tradable, SCAN_CONCURRENCY, async (h): Promise<PortfolioPosition> => {
    const currentPriceUsd = h.amount > 0 ? (h.valueUsd ?? 0) / h.amount : 0

    let riskScore = 0
    let warnings: string[] = []
    try {
      const risk = await assessRiskByMint(h.mint, 'solana', 'fast')
      riskScore = risk.riskScore
      warnings = flagsToWarnings(risk.snapshot.reasoning.flags)
    } catch {
      /* risk best-effort */
    }

    const entry = await readEntry(walletAddress, h.mint)
    const estimated = entry == null
    const avgEntryPriceUsd = entry?.avgEntryPriceUsd ?? currentPriceUsd
    const costBasis = avgEntryPriceUsd * h.amount
    const pnlUsd = estimated ? 0 : (h.valueUsd ?? 0) - costBasis
    const pnlPct = !estimated && costBasis > 0 ? (pnlUsd / costBasis) * 100 : 0
    const riskDelta = entry ? riskScore - entry.entryRiskScore : 0

    return {
      mint: h.mint,
      chain,
      symbol: h.symbol ?? h.mint.slice(0, 4),
      amountTokens: h.amount,
      avgEntryPriceUsd,
      currentPriceUsd,
      valueUsd: h.valueUsd ?? 0,
      pnlUsd,
      pnlPct,
      riskScore,
      riskDelta,
      warnings,
      estimated,
    }
  })

  const totalValueUsd = positions.reduce((a, p) => a + p.valueUsd, 0)
  const totalPnlUsd = positions.reduce((a, p) => a + p.pnlUsd, 0)
  const costBasisTotal = positions.reduce((a, p) => a + p.avgEntryPriceUsd * p.amountTokens, 0)
  const totalPnlPct = costBasisTotal > 0 ? (totalPnlUsd / costBasisTotal) * 100 : 0

  const portfolio: Portfolio = {
    walletAddress,
    chain,
    totalValueUsd,
    totalPnlUsd,
    totalPnlPct,
    riskExposure: computeExposure(positions),
    positions,
    lastUpdatedAt: new Date().toISOString(),
  }

  void writeSnapshot(portfolio)
  return portfolio
}
