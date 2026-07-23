import { NextResponse } from 'next/server'
import { listLaunches } from '@/lib/launch/confirm-launch'
import { readPoolMigrationStatus } from '@/lib/launch/migration-sync'
import { LAUNCH_COMPLIANCE } from '@/lib/launch/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/launch/list — recent CryptoCheck-platform launches with Neural V4 badges. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const enrich = url.searchParams.get('enrich') !== '0'
  const creator = url.searchParams.get('creator')?.trim() || undefined
  try {
    const launches = await listLaunches(limit, creator ? { creator } : undefined)
    if (enrich) {
      await Promise.all(
        launches.map(async (l) => {
          if (l.migrationStatus === 'migrated') return
          const onchain = await readPoolMigrationStatus(l.mint, l.poolId)
          if (!onchain) return
          l.migrationStatus = onchain.lane
          if (onchain.lane === 'migrated' && !l.poolId) l.poolId = onchain.poolId
        }),
      )
    }
    return NextResponse.json(
      { launches, compliance: LAUNCH_COMPLIANCE },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        launches: [],
        error: e instanceof Error ? e.message : String(e),
        compliance: LAUNCH_COMPLIANCE,
      },
      { status: 502 },
    )
  }
}
