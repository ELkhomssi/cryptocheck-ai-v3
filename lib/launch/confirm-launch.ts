import 'server-only'

import { getPdaLaunchpadPoolId, LaunchpadPool } from '@raydium-io/raydium-sdk-v2'
import { NATIVE_MINT } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { scanResultFromAssessment, toRevenueVerdict } from '@/lib/revenue-dashboard/types'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getPlatformId, getRpcUrl, launchCluster, launchProgramId } from './config'
import type { LaunchRecord } from './types'

export type ConfirmLaunchInput = {
  mint: string
  signature: string
  creatorWallet?: string
  name?: string
  ticker?: string
  description?: string
  imageUrl?: string
  supply?: string
  totalSellA?: string
  totalFundRaisingB?: string
  solTarget?: number
  curveType?: string
  poolId?: string
}

/**
 * Verify the on-chain launch pool uses OUR platformId, auto-scan via gateway,
 * and persist to token_launches.
 */
export async function confirmLaunch(input: ConfirmLaunchInput): Promise<LaunchRecord> {
  const mint = new PublicKey(input.mint.trim())
  const platformId = getPlatformId()
  const programId = launchProgramId()
  const connection = new Connection(getRpcUrl(), 'confirmed')

  const sig = input.signature.trim()
  if (!sig || sig.length < 32) {
    throw new Error('Valid transaction signature required')
  }

  const status = await connection.getSignatureStatus(sig, { searchTransactionHistory: true })
  const conf = status.value?.confirmationStatus
  if (!status.value || status.value.err) {
    throw new Error('Launch transaction not confirmed or failed on-chain')
  }
  if (conf !== 'confirmed' && conf !== 'finalized') {
    // Allow processed if present — still soft-fail if missing entirely
    if (!status.value.confirmationStatus) {
      throw new Error('Launch transaction not yet confirmed')
    }
  }

  const poolId = getPdaLaunchpadPoolId(programId, mint, NATIVE_MINT).publicKey
  const poolAccount = await connection.getAccountInfo(poolId)
  if (!poolAccount) {
    throw new Error(`Launch pool not found for mint ${mint.toBase58()}`)
  }

  const pool = LaunchpadPool.decode(poolAccount.data)
  if (!pool.platformId.equals(platformId)) {
    throw new Error(
      `Pool platformId ${pool.platformId.toBase58()} does not match CryptoCheck platform ${platformId.toBase58()}`,
    )
  }

  const creator = pool.creator.toBase58()
  if (input.creatorWallet && input.creatorWallet.trim() !== creator) {
    throw new Error('Creator wallet does not match on-chain pool creator')
  }

  // Auto Neural V4 scan via gateway (frozen core untouched).
  // Devnet mints are not on mainnet enrichment RPCs — persist anyway with a labeled fail-open.
  let safetyScore: number | null = null
  let riskScore: number | null = null
  let verdict: LaunchRecord['verdict'] = null
  let name = input.name ?? ''
  let ticker = input.ticker ?? ''

  try {
    const assessment = await assessRiskByMint(mint.toBase58(), 'solana', 'fast')
    const scan = scanResultFromAssessment(mint.toBase58(), assessment, {
      symbol: input.ticker,
      name: input.name,
    })
    safetyScore = scan.safetyScore
    riskScore = scan.riskScore
    verdict = toRevenueVerdict(assessment.verdict)
    name = input.name ?? scan.name
    ticker = input.ticker ?? scan.symbol
  } catch (e) {
    if (launchCluster() !== 'devnet') throw e
    console.warn(
      '[confirm-launch] Neural V4 scan soft-failed ondevnet:',
      e instanceof Error ? e.message : e,
    )
  }

  const row = {
    mint: mint.toBase58(),
    creator,
    name,
    ticker,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    supply: input.supply ?? pool.supply.toString(),
    total_sell_a: input.totalSellA ?? pool.totalSellA.toString(),
    total_fund_raising_b: input.totalFundRaisingB ?? pool.totalFundRaisingB.toString(),
    sol_target: input.solTarget ?? pool.totalFundRaisingB.toNumber() / 1e9,
    curve_type: input.curveType ?? 'justsendit',
    platform_id: platformId.toBase58(),
    pool_id: poolId.toBase58(),
    tx_signature: sig,
    safety_score: safetyScore,
    risk_score: riskScore,
    verdict,
    badge: verdict,
    migration_status: 'curve',
    migrated_at: null,
    migration_tx: null,
  }

  const sb = getSupabaseAdmin()
  let data: Record<string, unknown> | null = null
  let error: { message: string; code?: string } | null = null

  {
    const res = await sb.from('token_launches').upsert(row, { onConflict: 'mint' }).select('*').single()
    data = res.data as Record<string, unknown> | null
    error = res.error
  }

  // Pre-migration deployments may lack migration_* columns — retry without them.
  if (error && /migration_status|migrated_at|migration_tx/i.test(error.message)) {
    const {
      migration_status: _ms,
      migrated_at: _ma,
      migration_tx: _mx,
      ...legacy
    } = row
    const res = await sb.from('token_launches').upsert(legacy, { onConflict: 'mint' }).select('*').single()
    data = res.data as Record<string, unknown> | null
    error = res.error
    if (!error) {
      console.warn(
        '[confirm-launch] token_launches missing migration columns — apply supabase/migrations/20260715_token_launches_migration_status.sql',
      )
    }
  }

  if (error) {
    throw new Error(`Failed to persist launch: ${error.message}`)
  }

  return mapRow(data as Record<string, unknown>)
}

export async function listLaunches(
  limit = 20,
  opts?: { creator?: string },
): Promise<LaunchRecord[]> {
  const sb = getSupabaseAdmin()
  let q = sb
    .from('token_launches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(1, limit), 100))

  const creator = opts?.creator?.trim()
  if (creator) q = q.eq('creator', creator)

  const { data, error } = await q

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function getLaunchByMint(mint: string): Promise<LaunchRecord | null> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('token_launches')
    .select('*')
    .eq('mint', mint.trim())
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

function mapRow(r: Record<string, unknown>): LaunchRecord {
  return {
    id: String(r.id),
    mint: String(r.mint),
    creator: String(r.creator),
    name: String(r.name ?? ''),
    ticker: String(r.ticker ?? ''),
    description: r.description != null ? String(r.description) : null,
    imageUrl: r.image_url != null ? String(r.image_url) : null,
    supply: String(r.supply ?? '0'),
    totalSellA: String(r.total_sell_a ?? '0'),
    totalFundRaisingB: String(r.total_fund_raising_b ?? '0'),
    solTarget: Number(r.sol_target ?? 0),
    curveType: String(r.curve_type ?? 'justsendit'),
    platformId: String(r.platform_id ?? ''),
    poolId: r.pool_id != null ? String(r.pool_id) : null,
    txSignature: String(r.tx_signature ?? ''),
    safetyScore: r.safety_score != null ? Number(r.safety_score) : null,
    riskScore: r.risk_score != null ? Number(r.risk_score) : null,
    verdict: (r.verdict as LaunchRecord['verdict']) ?? null,
    badge: (r.badge as LaunchRecord['badge']) ?? null,
    migrationStatus: (['curve', 'migrate', 'migrated'].includes(String(r.migration_status))
      ? String(r.migration_status)
      : 'curve') as LaunchRecord['migrationStatus'],
    migratedAt: r.migrated_at != null ? String(r.migrated_at) : null,
    migrationTx: r.migration_tx != null ? String(r.migration_tx) : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }
}
