import 'server-only'

import { LaunchpadPool } from '@raydium-io/raydium-sdk-v2'
import { Connection, PublicKey } from '@solana/web3.js'
import { redis } from '@/lib/cache/redis'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getRpcUrl } from './config'
import { syncLaunchMigrations } from './migration-sync'

const ALERT_WEBHOOK = () => process.env.LAUNCH_ALERT_WEBHOOK_URL?.trim() || ''
const PREPARE_VELOCITY_KEY = 'ccai:launch:prepare:window'
const ALERT_DEDUP_PREFIX = 'ccai:launch:alert:dedup:'

/** Max prepares in a sliding window before abuse alert. */
const VELOCITY_MAX = Number(process.env.LAUNCH_PREPARE_VELOCITY_MAX ?? 30)
const VELOCITY_WINDOW_SEC = Number(process.env.LAUNCH_PREPARE_VELOCITY_WINDOW_SEC ?? 300)
/** Seconds after status=Migrate before we alert that crank stalled. */
const MIGRATE_STALL_SEC = Number(process.env.LAUNCH_MIGRATE_STALL_SEC ?? 60)

export type LaunchAlert = {
  type: 'migration_stall' | 'fee_claim_failure' | 'prepare_velocity' | 'info'
  severity: 'critical' | 'warning' | 'info'
  message: string
  mint?: string
  meta?: Record<string, unknown>
  at: string
}

async function emitAlert(alert: LaunchAlert): Promise<void> {
  const dedupKey = `${ALERT_DEDUP_PREFIX}${alert.type}:${alert.mint ?? 'global'}`
  try {
    const seen = await redis.get(dedupKey)
    if (seen) return
    await redis.setex(dedupKey, 300, '1')
  } catch {
    /* best-effort dedup */
  }

  console.error('[launch-alert]', JSON.stringify(alert))

  const url = ALERT_WEBHOOK()
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `[Launch ${alert.severity}] ${alert.type}: ${alert.message}`,
        alert,
      }),
      signal: AbortSignal.timeout(8_000),
    })
  } catch (e) {
    console.error('[launch-alert] webhook failed', e instanceof Error ? e.message : e)
  }
}

/** Call from /api/launch/prepare after a successful (non-blocked) attempt is admitted. */
export async function recordPrepareAttempt(creatorWallet: string): Promise<void> {
  const key = `${PREPARE_VELOCITY_KEY}:${Math.floor(Date.now() / (VELOCITY_WINDOW_SEC * 1000))}`
  try {
    const n = await redis.incr(key)
    if (n === 1) await redis.expire(key, VELOCITY_WINDOW_SEC * 2)
    if (n === VELOCITY_MAX + 1) {
      await emitAlert({
        type: 'prepare_velocity',
        severity: 'warning',
        message: `Prepare velocity exceeded ${VELOCITY_MAX} in ~${VELOCITY_WINDOW_SEC}s`,
        meta: { count: n, creatorSample: creatorWallet.slice(0, 8) },
        at: new Date().toISOString(),
      })
    }
  } catch {
    /* non-fatal */
  }
}

export async function recordFeeClaimFailure(detail: string, mint?: string): Promise<void> {
  await emitAlert({
    type: 'fee_claim_failure',
    severity: 'critical',
    message: detail,
    mint,
    at: new Date().toISOString(),
  })
}

/**
 * Sync DB lanes + alert if any pool is stuck in Migrate (status=1) beyond stall window.
 */
export async function runLaunchOpsMonitor(): Promise<{
  sync: Awaited<ReturnType<typeof syncLaunchMigrations>>
  stalls: Array<{ mint: string; poolId: string; ageSec: number }>
  alertsEmitted: number
}> {
  const sync = await syncLaunchMigrations(100)
  const connection = new Connection(getRpcUrl(), 'confirmed')
  const sb = getSupabaseAdmin()

  const { data } = await sb
    .from('token_launches')
    .select('mint, pool_id, migration_status, created_at, migrated_at')
    .in('migration_status', ['curve', 'migrate'])
    .order('created_at', { ascending: false })
    .limit(100)

  const stalls: Array<{ mint: string; poolId: string; ageSec: number }> = []
  let alertsEmitted = 0

  for (const row of data ?? []) {
    const mint = String(row.mint)
    if (!row.pool_id) continue
    let poolId: PublicKey
    try {
      poolId = new PublicKey(String(row.pool_id))
    } catch {
      continue
    }
    const acct = await connection.getAccountInfo(poolId)
    if (!acct) continue
    const pool = LaunchpadPool.decode(acct.data)
    const status = Number(pool.status)

    if (status === 1) {
      // Prefer migrated_at null + created_at as lower bound; better: track first_seen migrate in redis
      const seenKey = `ccai:launch:migrate_seen:${mint}`
      let firstSeen = await redis.get(seenKey)
      if (!firstSeen) {
        firstSeen = new Date().toISOString()
        await redis.setex(seenKey, 86_400, firstSeen)
      }
      const ageSec = Math.floor((Date.now() - new Date(firstSeen).getTime()) / 1000)
      if (ageSec >= MIGRATE_STALL_SEC) {
        stalls.push({ mint, poolId: poolId.toBase58(), ageSec })
        await emitAlert({
          type: 'migration_stall',
          severity: 'critical',
          message: `Pool status=Migrate for ${ageSec}s without Migrated (≥${MIGRATE_STALL_SEC}s)`,
          mint,
          meta: { poolId: poolId.toBase58(), ageSec },
          at: new Date().toISOString(),
        })
        alertsEmitted += 1
      }
    } else if (status >= 2) {
      await redis.del(`ccai:launch:migrate_seen:${mint}`).catch(() => undefined)
    }
  }

  return { sync, stalls, alertsEmitted }
}

export async function getLaunchOpsSummary(): Promise<{
  launchesToday: number
  migrationsToday: number
  feesClaimedToday: number | null
  paused: boolean
  sampleNote: string
}> {
  const sb = getSupabaseAdmin()
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const iso = start.toISOString()

  const { count: launchesToday } = await sb
    .from('token_launches')
    .select('mint', { count: 'exact', head: true })
    .gte('created_at', iso)

  const { count: migrationsToday } = await sb
    .from('token_launches')
    .select('mint', { count: 'exact', head: true })
    .eq('migration_status', 'migrated')
    .gte('migrated_at', iso)

  const { isLaunchModePaused } = await import('./control')
  const paused = await isLaunchModePaused()

  // Fee claim totals require on-chain / ledger wiring — null until fee ledger is bound.
  return {
    launchesToday: launchesToday ?? 0,
    migrationsToday: migrationsToday ?? 0,
    feesClaimedToday: null,
    paused,
    sampleNote:
      'feesClaimedToday is null until revenue fee ledger binds LaunchLab vault claims (no fabricated totals).',
  }
}
