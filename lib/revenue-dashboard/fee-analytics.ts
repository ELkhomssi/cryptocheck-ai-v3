import 'server-only'

import { Connection, PublicKey } from '@solana/web3.js'
import { getSolanaConnection } from '@/lib/solana/connection'
import { getPlatformFeeAccount } from '@/lib/trading/platform-fee-config'
import { listFeeRecords } from './fee-store'
import type { FeeRecord } from './types'

export type WalletHeuristic = 'likely_human' | 'likely_bot' | 'unknown'

export type FeeTimeBucket = {
  periodStart: string
  periodEnd: string
  label: string
  feeUsd: number
  volumeUsd: number
  swapCount: number
}

export type RevenueMetrics = {
  generatedAt: string
  ledger: {
    totalFeesUsd: number
    totalVolumeUsd: number
    swapCount: number
    uniqueWallets: number
    weeklyFeesUsd: number
    weeklyLabel: string
  }
  humanHeuristic: {
    label: string
    likelyHumanWallets: number
    likelyBotWallets: number
    unknownWallets: number
    note: string
  }
  onChain: {
    configured: boolean
    feeAccount: string | null
    tokenMint: string | null
    balanceRaw: string
    balanceUi: number | null
    decimals: number | null
  }
  reconciliation: {
    ledgerFeesUsd: number
    onChainBalanceUi: number | null
    note: string
  }
  daily: FeeTimeBucket[]
  weekly: FeeTimeBucket[]
  recent: FeeRecord[]
}

const HEURISTIC_NOTE =
  'Heuristic only — based on swap count in our ledger and shallow on-chain signature history. Not proof of humanity.'

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function startOfUtcWeek(d: Date): Date {
  const day = startOfUtcDay(d)
  const dow = day.getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  day.setUTCDate(day.getUTCDate() + diff)
  return day
}

function bucketDaily(records: FeeRecord[], days: number): FeeTimeBucket[] {
  const now = startOfUtcDay(new Date())
  const buckets: FeeTimeBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(now)
    start.setUTCDate(start.getUTCDate() - i)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)
    const inBucket = records.filter((r) => {
      const t = Date.parse(r.executedAt)
      return t >= start.getTime() && t < end.getTime()
    })
    const feeUsd = inBucket.reduce((a, r) => a + (r.feeAmountUsd ?? 0), 0)
    const volumeUsd = inBucket.reduce((a, r) => a + r.volumeUsd, 0)
    buckets.push({
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      label: start.toISOString().slice(0, 10),
      feeUsd,
      volumeUsd,
      swapCount: inBucket.length,
    })
  }
  return buckets
}

function bucketWeekly(records: FeeRecord[], weeks: number): FeeTimeBucket[] {
  const now = startOfUtcWeek(new Date())
  const buckets: FeeTimeBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(now)
    start.setUTCDate(start.getUTCDate() - i * 7)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 7)
    const inBucket = records.filter((r) => {
      const t = Date.parse(r.executedAt)
      return t >= start.getTime() && t < end.getTime()
    })
    const feeUsd = inBucket.reduce((a, r) => a + (r.feeAmountUsd ?? 0), 0)
    const volumeUsd = inBucket.reduce((a, r) => a + r.volumeUsd, 0)
    buckets.push({
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      label: `W/C ${start.toISOString().slice(0, 10)}`,
      feeUsd,
      volumeUsd,
      swapCount: inBucket.length,
    })
  }
  return buckets
}

async function classifyWallet(
  connection: Connection,
  wallet: string,
  records: FeeRecord[],
): Promise<WalletHeuristic> {
  const count = records.filter((r) => r.walletAddress === wallet).length
  if (count >= 2) return 'likely_human'
  try {
    const sigs = await connection.getSignaturesForAddress(new PublicKey(wallet), { limit: 8 })
    if (sigs.length >= 4) return 'likely_human'
    if (sigs.length <= 1) return 'likely_bot'
  } catch {
    /* RPC unavailable */
  }
  return 'unknown'
}

async function buildHumanHeuristic(records: FeeRecord[]): Promise<RevenueMetrics['humanHeuristic']> {
  const wallets = [...new Set(records.map((r) => r.walletAddress))]
  if (wallets.length === 0) {
    return {
      label: 'Verified human wallets (heuristic)',
      likelyHumanWallets: 0,
      likelyBotWallets: 0,
      unknownWallets: 0,
      note: HEURISTIC_NOTE,
    }
  }

  const connection = getSolanaConnection()
  let likelyHuman = 0
  let likelyBot = 0
  let unknown = 0

  for (const w of wallets.slice(0, 100)) {
    const h = await classifyWallet(connection, w, records)
    if (h === 'likely_human') likelyHuman += 1
    else if (h === 'likely_bot') likelyBot += 1
    else unknown += 1
  }

  return {
    label: 'Verified human wallets (heuristic)',
    likelyHumanWallets: likelyHuman,
    likelyBotWallets: likelyBot,
    unknownWallets: unknown,
    note: HEURISTIC_NOTE,
  }
}

async function readOnChainFeeAccount(): Promise<RevenueMetrics['onChain']> {
  const feeAccount = getPlatformFeeAccount()
  if (!feeAccount) {
    return {
      configured: false,
      feeAccount: null,
      tokenMint: null,
      balanceRaw: '0',
      balanceUi: null,
      decimals: null,
    }
  }

  try {
    const connection = getSolanaConnection()
    const bal = await connection.getTokenAccountBalance(new PublicKey(feeAccount))
    return {
      configured: true,
      feeAccount,
      tokenMint: null,
      balanceRaw: bal.value.amount,
      balanceUi: bal.value.uiAmount ?? null,
      decimals: bal.value.decimals,
    }
  } catch {
    return {
      configured: true,
      feeAccount,
      tokenMint: null,
      balanceRaw: '0',
      balanceUi: null,
      decimals: null,
    }
  }
}

export async function buildRevenueMetrics(): Promise<RevenueMetrics> {
  const records = await listFeeRecords(2000)
  const totalFeesUsd = records.reduce((a, r) => a + (r.feeAmountUsd ?? 0), 0)
  const totalVolumeUsd = records.reduce((a, r) => a + r.volumeUsd, 0)
  const wallets = new Set(records.map((r) => r.walletAddress))

  const weekStart = startOfUtcWeek(new Date())
  const weeklyRecords = records.filter((r) => Date.parse(r.executedAt) >= weekStart.getTime())
  const weeklyFeesUsd = weeklyRecords.reduce((a, r) => a + (r.feeAmountUsd ?? 0), 0)

  const [humanHeuristic, onChain] = await Promise.all([
    buildHumanHeuristic(records),
    readOnChainFeeAccount(),
  ])

  let reconciliationNote =
    'Ledger totals come from confirmed swaps recorded in Redis. On-chain balance is the live SPL fee account.'
  if (!onChain.configured) {
    reconciliationNote = 'Platform fee account not configured — on-chain reconciliation unavailable.'
  } else if (records.length === 0) {
    reconciliationNote = 'No swaps recorded yet. On-chain balance may include fees from other sources.'
  }

  return {
    generatedAt: new Date().toISOString(),
    ledger: {
      totalFeesUsd,
      totalVolumeUsd,
      swapCount: records.length,
      uniqueWallets: wallets.size,
      weeklyFeesUsd,
      weeklyLabel: `Week of ${weekStart.toISOString().slice(0, 10)} (UTC)`,
    },
    humanHeuristic,
    onChain,
    reconciliation: {
      ledgerFeesUsd: totalFeesUsd,
      onChainBalanceUi: onChain.balanceUi,
      note: reconciliationNote,
    },
    daily: bucketDaily(records, 14),
    weekly: bucketWeekly(records, 8),
    recent: records.slice(0, 25),
  }
}

export function feeRecordsToCsv(records: FeeRecord[]): string {
  const header = [
    'id',
    'signature',
    'walletAddress',
    'inputMint',
    'outputMint',
    'volumeUsd',
    'feeBps',
    'feeAmountBase',
    'feeAmountUsd',
    'feeTokenAccount',
    'executedAt',
    'humanWalletHeuristic',
  ]
  const rows = records.map((r) =>
    [
      r.id,
      r.signature,
      r.walletAddress,
      r.inputMint,
      r.outputMint,
      String(r.volumeUsd),
      String(r.feeBps),
      r.feeAmountBase,
      r.feeAmountUsd != null ? String(r.feeAmountUsd) : '',
      r.feeTokenAccount,
      r.executedAt,
      r.humanWalletHeuristic ?? 'unknown',
    ]
      .map(csvEscape)
      .join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}
