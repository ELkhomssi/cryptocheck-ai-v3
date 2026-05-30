import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { indexProtocolEvent } from '@/lib/web4/protocol/stats-index'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  type: z.enum(['trade', 'graduate', 'deploy']),
  lamports: z.string().optional(),
  wallet: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = bodySchema.parse(json)
    await indexProtocolEvent({
      type: parsed.type,
      lamports: parsed.lamports ? BigInt(parsed.lamports) : undefined,
      wallet: parsed.wallet,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid payload'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
