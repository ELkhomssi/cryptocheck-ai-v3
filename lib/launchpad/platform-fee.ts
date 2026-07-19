/**
 * Platform fee disclosure helpers — exact amounts from Jupiter quotes.
 * Never hardcode bps in JSX; always read via getPlatformFeeBps().
 */

export type PlatformFeeDisclosure = {
  feeBps: number
  /** Exact fee in output-token base units (from quote × bps). */
  feeAmount: string
  feeMint: string
  /** Human label e.g. "0.0042 SOL" when input is SOL (approx from inAmount × bps). */
  feeAmountHuman: string
  feeUsd: number | null
  feeAccount: string | null
  configured: boolean
}

export function formatBaseAsSol(lamports: string | number): string {
  const n = typeof lamports === 'string' ? Number(lamports) : lamports
  if (!Number.isFinite(n)) return '0 SOL'
  return `${(n / 1e9).toFixed(6).replace(/\.?0+$/, '')} SOL`
}

export function computePlatformFeeDisclosure(input: {
  feeBps: number
  feeAccount: string | null
  /** Prefer Jupiter platformFee when present; else outAmount × bps. */
  feeAmountBase?: string
  outAmountBase: string
  inAmountBase: string
  inputMint: string
  outputMint: string
  solUsd?: number
}): PlatformFeeDisclosure {
  const configured = Boolean(input.feeAccount) && input.feeBps > 0
  const bps = configured ? input.feeBps : 0

  let feeAmount = '0'
  if (bps > 0) {
    if (input.feeAmountBase && input.feeAmountBase !== '0') {
      feeAmount = input.feeAmountBase
    } else {
      try {
        feeAmount = ((BigInt(input.outAmountBase) * BigInt(bps)) / 10000n).toString()
      } catch {
        feeAmount = '0'
      }
    }
  }

  // Human line prefers input SOL skim estimate for snipes (SOL → token).
  const SOL = 'So11111111111111111111111111111111111111112'
  let feeAmountHuman = `${feeAmount} base`
  let feeUsd: number | null = null

  if (input.inputMint === SOL && bps > 0) {
    try {
      const feeLamports = (BigInt(input.inAmountBase) * BigInt(bps)) / 10000n
      feeAmountHuman = formatBaseAsSol(feeLamports.toString())
      if (input.solUsd) {
        feeUsd = (Number(feeLamports) / 1e9) * input.solUsd
      }
    } catch {
      /* keep base */
    }
  } else if (input.solUsd && bps > 0 && input.inputMint === SOL) {
    feeUsd = (Number(input.inAmountBase) / 1e9) * input.solUsd * (bps / 10000)
  }

  return {
    feeBps: bps,
    feeAmount,
    feeMint: input.outputMint,
    feeAmountHuman,
    feeUsd,
    feeAccount: input.feeAccount,
    configured,
  }
}
