import 'server-only'

import { getPdaLaunchpadPoolId, LaunchpadPool } from '@raydium-io/raydium-sdk-v2'
import { NATIVE_MINT } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getRpcUrl, launchProgramId } from './config'
import type { LaunchRecord } from './types'

export type MigrationSyncResult = {
  checked: number
  updated: number
  results: Array<{
    mint: string
    from: string
    to: string
    poolStatus: number
    migrationTx: string | null
  }>
  dbColumnsReady: boolean
}

function statusToLane(status: number): LaunchRecord['migrationStatus'] {
  if (status >= 2) return 'migrated'
  if (status === 1) return 'migrate'
  return 'curve'
}

export async function readPoolMigrationStatus(
  mint: string,
  poolIdHint?: string | null,
): Promise<{ poolStatus: number; lane: LaunchRecord['migrationStatus']; poolId: string } | null> {
  const connection = new Connection(getRpcUrl(), 'confirmed')
  const programId = launchProgramId()
  let poolId: PublicKey
  try {
    poolId = poolIdHint
      ? new PublicKey(poolIdHint)
      : getPdaLaunchpadPoolId(programId, new PublicKey(mint), NATIVE_MINT).publicKey
  } catch {
    return null
  }
  const acct = await connection.getAccountInfo(poolId)
  if (!acct) return null
  const pool = LaunchpadPool.decode(acct.data)
  const poolStatus = Number(pool.status)
  return { poolStatus, lane: statusToLane(poolStatus), poolId: poolId.toBase58() }
}

/**
 * Poll on-chain LaunchpadPool.status for launches and advance token_launches.migration_status.
 * If migration_* columns are not migrated yet, still returns on-chain results (updated=0).
 */
export async function syncLaunchMigrations(limit = 50): Promise<MigrationSyncResult> {
  const sb = getSupabaseAdmin()
  let rows: Array<{ mint: string; pool_id: string | null; migration_status?: string; migration_tx?: string | null }> =
    []
  let dbColumnsReady = true

  {
    const { data, error } = await sb
      .from('token_launches')
      .select('mint, pool_id, migration_status, migration_tx')
      .in('migration_status', ['curve', 'migrate'])
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(1, limit), 200))

    if (error && /migration_status|42703/i.test(error.message)) {
      dbColumnsReady = false
      const fallback = await sb
        .from('token_launches')
        .select('mint, pool_id')
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(1, limit), 200))
      if (fallback.error) throw new Error(`migration sync query failed: ${fallback.error.message}`)
      rows = (fallback.data ?? []).map((r) => ({
        mint: String(r.mint),
        pool_id: r.pool_id != null ? String(r.pool_id) : null,
        migration_status: 'curve',
        migration_tx: null,
      }))
    } else if (error) {
      throw new Error(`migration sync query failed: ${error.message}`)
    } else {
      rows = (data ?? []).map((r) => ({
        mint: String(r.mint),
        pool_id: r.pool_id != null ? String(r.pool_id) : null,
        migration_status: String(r.migration_status ?? 'curve'),
        migration_tx: r.migration_tx != null ? String(r.migration_tx) : null,
      }))
    }
  }

  const connection = new Connection(getRpcUrl(), 'confirmed')
  const results: MigrationSyncResult['results'] = []
  let updated = 0

  for (const row of rows) {
    const mint = row.mint
    const from = row.migration_status ?? 'curve'
    const onchain = await readPoolMigrationStatus(mint, row.pool_id)
    if (!onchain) continue
    const to = onchain.lane
    if (to === from && dbColumnsReady) continue

    let migrationTx: string | null = row.migration_tx ?? null
    if (to === 'migrated' && !migrationTx) {
      migrationTx = await findMigrationSignature(connection, new PublicKey(onchain.poolId)).catch(
        () => null,
      )
    }

    if (dbColumnsReady && to !== from) {
      const patch: Record<string, unknown> = {
        migration_status: to,
        pool_id: onchain.poolId,
      }
      if (to === 'migrated') {
        patch.migrated_at = new Date().toISOString()
        if (migrationTx) patch.migration_tx = migrationTx
      }
      const { error: upErr } = await sb.from('token_launches').update(patch).eq('mint', mint)
      if (!upErr) updated += 1
    }

    results.push({
      mint,
      from,
      to,
      poolStatus: onchain.poolStatus,
      migrationTx,
    })
  }

  return { checked: rows.length, updated, results, dbColumnsReady }
}

async function findMigrationSignature(
  connection: Connection,
  poolId: PublicKey,
): Promise<string | null> {
  const sigs = await connection.getSignaturesForAddress(poolId, { limit: 40 })
  for (const s of sigs) {
    if (s.err) continue
    const tx = await connection.getTransaction(s.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    })
    if (!tx) continue
    const logHasMigrate = (tx.meta?.logMessages ?? []).some((l) =>
      /migrate|cpswap|MigrateToCp/i.test(l),
    )
    if (logHasMigrate) return s.signature
  }
  const ok = sigs.find((x) => !x.err)
  return ok?.signature ?? null
}
