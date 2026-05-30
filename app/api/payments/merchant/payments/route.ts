import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { listMerchantPayments } from '@/lib/payments/payment-intent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** GET /api/payments/merchant/payments?wallet= — recent payments for a merchant (Redis, ephemeral). */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet', code: 'INVALID_WALLET' }, { status: 400, headers: CORS })
  }
  const payments = await listMerchantPayments(wallet, 100)
  return NextResponse.json({ wallet, payments }, { status: 200, headers: CORS })
}
