import { NextRequest, NextResponse } from 'next/server'
import { gatewayResponseHeaders } from '@/lib/connect/scan-gateway'
import { getJupiterQuote } from '@/lib/trading/jupiter-client'
import { getPlatformFeeAccount, getPlatformFeeBps } from '@/lib/trading/platform-fee-config'
import { fetchSolUsdPrice } from '@/lib/pricing/sol-usd'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { buildSwapQuoteFromJupiter } from '@/lib/revenue-dashboard/swap-quote'
import { MAX_SLIPPAGE_BPS } from '@/lib/revenue-dashboard/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const USDC_DECIMALS = 6
const DEFAULT_TOKEN_DECIMALS = 6

function parseInputAmountBase(inputMint: string, amount: number, tokenDecimals?: number): number {
  if (inputMint === SOL_MINT) {
    return Math.max(1, Math.floor(amount * 1e9))
  }
  if (inputMint === USDC_MINT) {
    return Math.max(1, Math.floor(amount * 10 ** USDC_DECIMALS))
  }
  const dec = tokenDecimals ?? DEFAULT_TOKEN_DECIMALS
  return Math.max(1, Math.floor(amount * 10 ** dec))
}

/** POST /api/revenue/quote — Jupiter quote + platform fee breakdown (buy or sell). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    inputMint?: string
    outputMint?: string
    amount?: number
    slippageBps?: number
    tokenDecimals?: number
  }

  const rawInput = typeof body.inputMint === 'string' ? body.inputMint.trim() : SOL_MINT
  const rawOutput = typeof body.outputMint === 'string' ? body.outputMint.trim() : ''
  const amount = Number(body.amount)
  const slippageBps = Number.isFinite(Number(body.slippageBps))
    ? Math.min(MAX_SLIPPAGE_BPS, Math.max(1, Number(body.slippageBps)))
    : 50

  let inputMint = rawInput
  let outputMint = rawOutput

  if (!isValidSolanaMint(inputMint) || !isValidSolanaMint(outputMint)) {
    return NextResponse.json(
      { error: 'Valid input and output mints required', code: 'INVALID_MINT' },
      { status: 400, headers: gatewayResponseHeaders() },
    )
  }
  if (inputMint === outputMint) {
    return NextResponse.json(
      { error: 'Input and output mint must differ', code: 'INVALID_PAIR' },
      { status: 400, headers: gatewayResponseHeaders() },
    )
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'Amount must be > 0', code: 'INVALID_AMOUNT' },
      { status: 400, headers: gatewayResponseHeaders() },
    )
  }

  const feeBps = getPlatformFeeBps()
  const feeAccount = getPlatformFeeAccount()
  const amountBase = parseInputAmountBase(inputMint, amount, body.tokenDecimals)

  let applyFee = Boolean(feeAccount && feeBps > 0)
  if (applyFee && feeAccount) {
    const { assertPlatformFeeAccountForOutput } = await import('@/lib/launchpad/fee-account')
    const check = await assertPlatformFeeAccountForOutput(outputMint)
    if (check.ok === false) {
      return NextResponse.json(
        {
          error: check.message,
          code: check.code,
          feeConfigured: false,
        },
        { status: 422, headers: gatewayResponseHeaders() },
      )
    }
  }

  try {
    const [quote, solUsd] = await Promise.all([
      getJupiterQuote(inputMint, outputMint, amountBase, slippageBps, {
        platformFeeBps: applyFee ? feeBps : undefined,
      }),
      fetchSolUsdPrice(),
    ])
    const swapQuote = buildSwapQuoteFromJupiter(quote, { solUsd })
    return NextResponse.json(
      {
        ...swapQuote,
        feeConfigured: Boolean(feeAccount),
      },
      { status: 200, headers: gatewayResponseHeaders() },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Quote failed'
    return NextResponse.json(
      { error: message, code: 'QUOTE_FAILED' },
      { status: 502, headers: gatewayResponseHeaders() },
    )
  }
}
