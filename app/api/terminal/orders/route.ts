import { NextRequest, NextResponse } from 'next/server'
import { createOrder, listOrders } from '@/lib/terminal/orders-store'
import type { TerminalOrderType } from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ORDER_TYPES = new Set<TerminalOrderType>(['limit', 'dca', 'tp', 'sl'])
const SOL_MINT = 'So11111111111111111111111111111111111111112'

/**
 * GET /api/terminal/orders?wallet=…
 * Lists tracked limit/DCA/TP/SL orders for a wallet (not fabricated fills).
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (wallet.length < 32) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }
  const orders = await listOrders(wallet, 50)
  return NextResponse.json({ orders, fetchedAt: new Date().toISOString() })
}

/**
 * POST /api/terminal/orders
 * Creates a tracked order. Does not execute a swap — status stays pending
 * until cron marks trigger_hit; user still signs Jupiter execution.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  const type = typeof body.type === 'string' ? (body.type.trim() as TerminalOrderType) : null
  const inputMint =
    typeof body.inputMint === 'string' ? body.inputMint.trim() : SOL_MINT
  const outputMint = typeof body.outputMint === 'string' ? body.outputMint.trim() : ''
  const amount = Number(body.amount)
  const triggerPrice =
    body.triggerPrice == null || body.triggerPrice === ''
      ? null
      : Number(body.triggerPrice)

  if (wallet.length < 32) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }
  if (!type || !ORDER_TYPES.has(type)) {
    return NextResponse.json({ error: 'type must be limit|dca|tp|sl' }, { status: 400 })
  }
  if (outputMint.length < 32 || inputMint.length < 32) {
    return NextResponse.json({ error: 'valid mints required' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
  }
  if (type !== 'dca' && (triggerPrice == null || !Number.isFinite(triggerPrice) || triggerPrice <= 0)) {
    return NextResponse.json(
      { error: 'triggerPrice required for limit/tp/sl' },
      { status: 400 },
    )
  }

  const order = await createOrder({
    wallet,
    type,
    inputMint,
    outputMint,
    amount,
    triggerPrice,
    expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : null,
  })

  return NextResponse.json({ order }, { status: 201 })
}
