import { NextResponse } from 'next/server'
import { AGENT_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { readAgentControl } from '@/lib/sentinel-edge/control'
import { buildLiveTrackRecord, readBacktestRecord } from '@/lib/sentinel-edge/track-record'

export const dynamic = 'force-dynamic'

/** GET /api/signals/agent/status — control plane + live track record. */
export async function GET() {
  const [control, track, backtest] = await Promise.all([
    readAgentControl(),
    buildLiveTrackRecord(),
    readBacktestRecord(),
  ])

  return NextResponse.json({
    control,
    track: {
      decisionsCount: track.decisionsCount,
      settlementsCount: track.settlementsCount,
      openCount: track.openCount,
      totalPnl: track.totalPnl,
      wins: track.wins,
      losses: track.losses,
      pushes: track.pushes,
      voids: track.voids,
      hitRate: track.hitRate,
      label: track.label,
    },
    backtest,
    compliance: AGENT_COMPLIANCE,
  })
}
