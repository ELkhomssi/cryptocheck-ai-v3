import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { saveMerchant, getMerchant } from '@/lib/payments/merchant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function baseUrl(): string {
  const u =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.CRYPTOCHECK_BASE_URL?.trim() ||
    'https://www.cryptocheckai.com'
  return u.replace(/\/$/, '')
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** POST /api/payments/merchant — register a wallet as a payment recipient. */
export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const walletAddress = typeof raw.walletAddress === 'string' ? raw.walletAddress.trim() : ''
  const merchantName = typeof raw.merchantName === 'string' ? raw.merchantName.trim().slice(0, 80) : ''
  const webhookUrl = typeof raw.webhookUrl === 'string' ? raw.webhookUrl.trim() : undefined
  const chain = raw.chain === 'ethereum' || raw.chain === 'base' ? String(raw.chain) : 'solana'

  if (!isValidSolanaMint(walletAddress)) {
    return NextResponse.json({ error: 'Invalid wallet address', code: 'INVALID_WALLET' }, { status: 400, headers: CORS })
  }
  if (!merchantName) {
    return NextResponse.json({ error: 'merchantName is required', code: 'INVALID_NAME' }, { status: 400, headers: CORS })
  }
  if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) {
    return NextResponse.json({ error: 'webhookUrl must be http(s)', code: 'INVALID_WEBHOOK' }, { status: 400, headers: CORS })
  }

  await saveMerchant({ walletAddress, merchantName, webhookUrl, chain, createdAt: new Date().toISOString() })
  return NextResponse.json(
    { ok: true, paymentUrl: `${baseUrl()}/pay/${walletAddress}` },
    { status: 200, headers: CORS }
  )
}

/** GET /api/payments/merchant?wallet= — fetch a merchant profile (public; no secrets stored). */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet', code: 'INVALID_WALLET' }, { status: 400, headers: CORS })
  }
  const merchant = await getMerchant(wallet)
  if (!merchant) {
    return NextResponse.json({ registered: false, walletAddress: wallet }, { status: 200, headers: CORS })
  }
  // Never echo webhookUrl publicly.
  return NextResponse.json(
    { registered: true, walletAddress: merchant.walletAddress, merchantName: merchant.merchantName, chain: merchant.chain },
    { status: 200, headers: CORS }
  )
}
