/**
 * Jupiter v6 client — Solana swap quotes, simulation, and swap-transaction build.
 * Native fetch only (no SDK dependency). Quote + simulate are server-safe;
 * signing/sending is delegated to a caller-supplied wallet (client-side).
 */

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap'
const DEFAULT_TIMEOUT_MS = 4000

export type JupiterQuote = {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: unknown[]
  /** Echoed raw response for the /swap call. */
  raw: Record<string, unknown>
}

export class JupiterError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'JupiterError'
  }
}

/** Minimal wallet surface — avoids a hard dependency on @solana/wallet-adapter types. */
export type WalletLike = {
  publicKey: { toBase58(): string } | null
  signTransaction: <T>(tx: T) => Promise<T>
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text()
    const parsed = text ? JSON.parse(text) : null
    if (!res.ok) {
      const msg =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `Jupiter HTTP ${res.status}`
      throw new JupiterError(msg, res.status)
    }
    return parsed
  } catch (e) {
    if (e instanceof JupiterError) throw e
    throw new JupiterError(e instanceof Error ? e.message : String(e))
  } finally {
    clearTimeout(timer)
  }
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number
): Promise<JupiterQuote> {
  const q = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(Math.max(0, Math.floor(amountLamports))),
    slippageBps: String(slippageBps),
  })
  const data = (await fetchJson(`${JUPITER_QUOTE_API}?${q.toString()}`)) as Record<string, unknown>
  if (!data || typeof data.outAmount !== 'string') {
    throw new JupiterError('No route found for this pair/amount')
  }
  return {
    inputMint: String(data.inputMint ?? inputMint),
    outputMint: String(data.outputMint ?? outputMint),
    inAmount: String(data.inAmount ?? amountLamports),
    outAmount: String(data.outAmount),
    otherAmountThreshold: String(data.otherAmountThreshold ?? '0'),
    swapMode: String(data.swapMode ?? 'ExactIn'),
    slippageBps: Number(data.slippageBps ?? slippageBps),
    priceImpactPct: String(data.priceImpactPct ?? '0'),
    routePlan: Array.isArray(data.routePlan) ? data.routePlan : [],
    raw: data,
  }
}

/**
 * Price impact + output for a pair without executing — used by `assessSwapIntent`.
 * Returns priceImpactPct as a fraction-of-100 number (e.g. 1.5 = 1.5%).
 */
export async function simulateJupiterSwap(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps = 50
): Promise<{ priceImpactPct: number; outAmount: number }> {
  const quote = await getJupiterQuote(inputMint, outputMint, amountLamports, slippageBps)
  return {
    priceImpactPct: Number(quote.priceImpactPct) * 100,
    outAmount: Number(quote.outAmount),
  }
}

/**
 * Requests the serialized swap transaction from Jupiter for a given quote.
 * Returns base64 `swapTransaction` (a VersionedTransaction) to be signed by the wallet.
 */
export async function buildJupiterSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string
): Promise<string> {
  const data = (await fetchJson(JUPITER_SWAP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote.raw,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  })) as { swapTransaction?: string }
  if (!data?.swapTransaction) {
    throw new JupiterError('Jupiter did not return a swapTransaction')
  }
  return data.swapTransaction
}
