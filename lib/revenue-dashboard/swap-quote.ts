import type { JupiterQuote } from '@/lib/trading/jupiter-client'
import { getPlatformFeeAccount, getPlatformFeeBps } from '@/lib/trading/platform-fee-config'
import type { SwapQuote } from './types'

const QUOTE_TTL_MS = 30_000

function routeLabelFromQuote(quote: JupiterQuote): string {
  const plan = quote.routePlan
  if (!Array.isArray(plan) || plan.length === 0) return 'Jupiter'
  const first = plan[0] as { swapInfo?: { label?: string; ammKey?: string } }
  return first?.swapInfo?.label ?? 'Jupiter route'
}

function estimatePlatformFeeBase(outAmountBase: string, bps: number): string {
  if (bps <= 0) return '0'
  try {
    const out = BigInt(outAmountBase)
    return ((out * BigInt(bps)) / 10000n).toString()
  } catch {
    return '0'
  }
}

export function buildSwapQuoteFromJupiter(
  quote: JupiterQuote,
  meta?: { solUsd?: number; inputDecimals?: number }
): SwapQuote {
  const bps = getPlatformFeeBps()
  const feeAccount = getPlatformFeeAccount() ?? ''
  const feeBase = estimatePlatformFeeBase(quote.outAmount, bps)
  const now = Date.now()

  let feeUsd: number | undefined
  if (meta?.solUsd && quote.inputMint === 'So11111111111111111111111111111111111111112') {
    const lamports = Number(quote.inAmount)
    const sol = lamports / 1e9
    const volUsd = sol * meta.solUsd
    feeUsd = volUsd * (bps / 10000)
  }

  return {
    quote,
    inputMint: quote.inputMint,
    outputMint: quote.outputMint,
    inputAmountBase: quote.inAmount,
    outputAmountBase: quote.outAmount,
    outputAmountMinBase: quote.otherAmountThreshold,
    priceImpactPct: Number(quote.priceImpactPct) * 100,
    slippageBps: quote.slippageBps,
    routeLabel: routeLabelFromQuote(quote),
    platformFee: {
      bps,
      amountBase: feeBase,
      amountUsd: feeUsd,
      feeTokenAccount: feeAccount,
    },
    quotedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
  }
}

export function isQuoteExpired(swapQuote: SwapQuote): boolean {
  return Date.parse(swapQuote.expiresAt) <= Date.now()
}
