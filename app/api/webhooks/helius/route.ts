import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Playbook alias: POST /api/webhooks/helius
 * Forwards to the portfolio desk Helius webhook handler.
 */
export async function POST(req: NextRequest) {
  const { POST: handle } = await import('../helius-portfolio/route')
  return handle(req)
}
