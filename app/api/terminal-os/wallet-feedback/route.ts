import { NextRequest, NextResponse } from 'next/server'
import {
  getWalletScanFeedback,
  registerWalletForScanFeedback,
  runWalletScanFeedbackForWallet,
} from '@/lib/terminal-os/wallet-scan-feedback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/terminal-os/wallet-feedback?wallet=
 * Optional refresh=1 forces one scan cycle for that wallet (Layer 4 read + register).
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim()
  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ error: 'wallet_required' }, { status: 400 })
  }

  try {
    await registerWalletForScanFeedback(wallet)
    let feedback = await getWalletScanFeedback(wallet)
    if (refresh || !feedback) {
      feedback = await runWalletScanFeedbackForWallet(wallet)
    }
    return NextResponse.json(
      { feedback, at: new Date().toISOString() },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (err) {
    console.error('[tos/wallet-feedback]', err)
    return NextResponse.json(
      { feedback: null, error: 'wallet_feedback_unavailable', at: new Date().toISOString() },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
}
