import { NextRequest, NextResponse } from 'next/server'
import { updateOrder } from '@/lib/terminal/orders-store'
import type { TerminalOrderStatus } from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/terminal/orders/[id]
 * Cancel a pending/trigger_hit order, or mark filled with a real signature.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : undefined
  const action = typeof body.action === 'string' ? body.action.trim() : ''
  const statusRaw = typeof body.status === 'string' ? body.status.trim() : ''
  const fillSignature =
    typeof body.fillSignature === 'string' ? body.fillSignature.trim() : null

  let status: TerminalOrderStatus | undefined
  if (action === 'cancel' || statusRaw === 'cancelled') {
    status = 'cancelled'
  } else if (statusRaw === 'filled') {
    if (!fillSignature || fillSignature.length < 32) {
      return NextResponse.json(
        { error: 'fillSignature required to mark filled' },
        { status: 400 },
      )
    }
    status = 'filled'
  } else if (statusRaw === 'trigger_hit' || statusRaw === 'expired') {
    status = statusRaw
  } else {
    return NextResponse.json(
      { error: 'action cancel or status cancelled|filled|trigger_hit|expired' },
      { status: 400 },
    )
  }

  const order = await updateOrder(id, {
    status,
    fillSignature: status === 'filled' ? fillSignature : undefined,
    wallet,
  })
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ order })
}
