import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Future: outbound webhook registration & delivery for Enterprise (high-safety events, batch completion).
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Webhook registration is not enabled yet',
      code: 501,
      reason: 'NOT_IMPLEMENTED',
      docs: '/api/docs',
    },
    { status: 501 }
  )
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Webhook registration is not enabled yet',
      code: 501,
      reason: 'NOT_IMPLEMENTED',
      docs: '/api/docs',
    },
    { status: 501 }
  )
}
