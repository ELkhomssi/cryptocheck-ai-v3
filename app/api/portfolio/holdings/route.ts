import { NextRequest, NextResponse } from 'next/server'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import {
  buildEvmHoldingsResponse,
  isValidEvmWallet,
  parseEvmHoldingsChain,
} from '@/lib/portfolio-desk/evm-holdings-service'
import { isValidSolanaWallet } from '@/lib/portfolio-desk/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio/holdings?wallet=…&chain=ethereum|base|bnb|arbitrum
 * Solana (base58) → Helius + Jupiter.
 * EVM (0x…) → RPC native + Ethplorer ERC-20 (ethereum) + DexScreener/CoinGecko prices.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  const chainParam = req.nextUrl.searchParams.get('chain')

  if (isValidEvmWallet(wallet)) {
    try {
      const chain = parseEvmHoldingsChain(chainParam)
      const data = await buildEvmHoldingsResponse(wallet, chain)
      return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'EVM holdings unavailable'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  if (!isValidSolanaWallet(wallet)) {
    return NextResponse.json({ error: 'wallet query param required' }, { status: 400 })
  }
  try {
    const data = await buildHoldingsResponse(wallet)
    return NextResponse.json({ ...data, chainFamily: 'solana', chain: 'solana' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Holdings unavailable'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
