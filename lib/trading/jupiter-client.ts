/**
 * Jupiter Swap API client — quotes + swap-transaction build.
 * Native fetch only (no SDK). Uses Metis Swap API hosts (quote-api.jup.ag retired).
 * Signing/sending stays wallet-side (non-custodial).
 */

const JUPITER_SWAP_BASES = [
  (process.env.JUPITER_API_BASE ?? '').replace(/\/$/, ''),
  'https://api.jup.ag/swap/v1',
  'https://lite-api.jup.ag/swap/v1',
].filter(Boolean)

const DEFAULT_TIMEOUT_MS = 8_000

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
    readonly status?: number,
  ) {
    super(message)
    this.name = 'JupiterError'
  }
}

export type JupiterQuoteOptions = {
  platformFeeBps?: number
}

export type JupiterSwapBuildOptions = {
  feeAccount?: string
  prioritizationFeeLamports?: number | 'auto' | { jitoTipLamports: number }
}

export type WalletLike = {
  publicKey: { toBase58(): string } | null
  signTransaction: <T>(tx: T) => Promise<T>
}

function jupiterHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const key = process.env.JUPITER_API_KEY?.trim()
  if (key) headers['x-api-key'] = key
  if (extra) {
    const e = new Headers(extra)
    e.forEach((v, k) => {
      headers[k] = v
    })
  }
  return headers
}

async function fetchJson(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  // Keep this module client-safe: RiskGatedSwapPanel and other "use client"
  // panels import getJupiterQuote / buildJupiterSwapTransaction. Provider quota
  // gating for Jupiter lives in lib/providers/jupiter.ts and server API routes.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...init,
      headers: jupiterHeaders(init?.headers),
      signal: controller.signal,
    })
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

/** Try primary + fallback Jupiter hosts (retired quote-api.jup.ag). */
async function fetchJsonWithFallback(
  pathAndQuery: string,
  init?: RequestInit,
): Promise<unknown> {
  let last: unknown
  for (const base of JUPITER_SWAP_BASES) {
    try {
      return await fetchJson(`${base}${pathAndQuery}`, init)
    } catch (e) {
      last = e
    }
  }
  throw last instanceof Error ? last : new JupiterError(String(last))
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number,
  options?: JupiterQuoteOptions,
): Promise<JupiterQuote> {
  const q = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(Math.max(0, Math.floor(amountLamports))),
    slippageBps: String(slippageBps),
  })
  const feeBps = options?.platformFeeBps
  if (typeof feeBps === 'number' && feeBps > 0) {
    q.set('platformFeeBps', String(feeBps))
  }
  const data = (await fetchJsonWithFallback(`/quote?${q.toString()}`)) as Record<string, unknown>
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
  slippageBps = 50,
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
  userPublicKey: string,
  options?: JupiterSwapBuildOptions,
): Promise<string> {
  const body: Record<string, unknown> = {
    quoteResponse: quote.raw,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
  }
  if (options?.feeAccount) {
    body.feeAccount = options.feeAccount
  }
  if (options?.prioritizationFeeLamports != null) {
    body.prioritizationFeeLamports = options.prioritizationFeeLamports
  }
  const data = (await fetchJsonWithFallback(`/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as { swapTransaction?: string }
  if (!data?.swapTransaction) {
    throw new JupiterError('Jupiter did not return a swapTransaction')
  }
  return data.swapTransaction
}
