import { NextRequest, NextResponse } from 'next/server'
import type { AgentControlState, AgentMode } from '@cryptocheck/signal-contracts'
import { readAgentControl, writeAgentControl } from '@/lib/sentinel-edge/control'

export const dynamic = 'force-dynamic'

function assertControlAuth(req: NextRequest): boolean {
  // Dashboard same-origin is enough for paper demo; optional bearer for automation.
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.SIGNAL_AGENT_SIGNING_KEY?.trim() ||
    ''
  if (!secret) return true
  if (!header) return true // cookie session UI
  return header === secret
}

/** GET /api/signals/agent/control */
export async function GET() {
  const control = await readAgentControl()
  return NextResponse.json({ control })
}

/** POST /api/signals/agent/control — kill-switch, mode, thresholds. */
export async function POST(req: NextRequest) {
  if (!assertControlAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Partial<AgentControlState>
  const patch: Partial<AgentControlState> = {}

  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.killSwitch === 'boolean') patch.killSwitch = body.killSwitch
  if (body.mode === 'paper' || body.mode === 'live') patch.mode = body.mode as AgentMode
  if (typeof body.edgeThreshold === 'number' && Number.isFinite(body.edgeThreshold)) {
    patch.edgeThreshold = Math.max(0, Math.min(100, body.edgeThreshold))
  }
  if (typeof body.confidenceFloor === 'number' && Number.isFinite(body.confidenceFloor)) {
    patch.confidenceFloor = Math.max(0, Math.min(1, body.confidenceFloor))
  }
  if (typeof body.maxPositionSize === 'number' && Number.isFinite(body.maxPositionSize)) {
    patch.maxPositionSize = Math.max(1, body.maxPositionSize)
  }
  if (typeof body.perMatchCap === 'number' && Number.isFinite(body.perMatchCap)) {
    patch.perMatchCap = Math.max(1, body.perMatchCap)
  }
  if (typeof body.dailyLossLimit === 'number' && Number.isFinite(body.dailyLossLimit)) {
    patch.dailyLossLimit = Math.max(1, body.dailyLossLimit)
  }

  const control = await writeAgentControl(patch)
  return NextResponse.json({ control })
}
