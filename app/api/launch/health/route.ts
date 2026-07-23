import { NextResponse } from 'next/server'
import { Connection } from '@solana/web3.js'
import { getCpConfigId, getPlatformId, getRpcUrl, launchCluster } from '@/lib/launch/config'
import { isLaunchModePaused } from '@/lib/launch/control'
import { isLaunchModeEnabled } from '@/lib/launch/feature-flag'
import { assertLaunchConfigValid } from '@/lib/launch/guards'
import { isPinataConfigured } from '@/lib/launch/metadata-pinata'
import { listLiquidityProviders } from '@/lib/launch/liquidity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/launch/health
 * Boot/ops probe — does not mutate state.
 */
export async function GET() {
  const started = Date.now()
  const checks: Record<string, { ok: boolean; detail?: string; ms?: number }> = {}

  try {
    assertLaunchConfigValid()
    checks.config = { ok: true }
  } catch (e) {
    checks.config = { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }

  const rpcStart = Date.now()
  try {
    const connection = new Connection(getRpcUrl(), 'confirmed')
    const slot = await connection.getSlot('confirmed')
    checks.rpc = { ok: true, detail: `slot=${slot}`, ms: Date.now() - rpcStart }
  } catch (e) {
    checks.rpc = {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      ms: Date.now() - rpcStart,
    }
  }

  try {
    const platformId = getPlatformId().toBase58()
    const cp = getCpConfigId().toBase58()
    checks.platform = { ok: true, detail: `platform=${platformId} cp=${cp}` }
  } catch (e) {
    checks.platform = { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }

  const paused = await isLaunchModePaused().catch(() => false)
  const enabled = isLaunchModeEnabled()
  checks.feature = {
    ok: enabled && !paused,
    detail: `enabled=${enabled} paused=${paused}`,
  }

  checks.metadata = {
    ok: true,
    detail: isPinataConfigured() ? 'pinata+redis' : 'self-hosted+redis',
  }

  checks.liquidity = {
    ok: true,
    detail: listLiquidityProviders()
      .map((p) => `${p.id}:${p.isAvailable() ? 'available' : 'reserved'}`)
      .join(','),
  }

  const ok = Object.values(checks).every((c) => c.ok)
  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      cluster: launchCluster(),
      checks,
      durationMs: Date.now() - started,
    },
    {
      status: ok ? 200 : 503,
      headers: { 'cache-control': 'no-store' },
    },
  )
}
