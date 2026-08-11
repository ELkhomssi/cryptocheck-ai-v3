import 'server-only'

import { enrichScanBodyFromChain } from '@/lib/services/scanner/solana-token-enrichment'

/**
 * Supported chain identifiers for CCAI Connect routing.
 * Solana remains the security-scanner path; EVM ports enrich market fields only
 * until assessRiskByMint accepts non-Solana (honest degrade elsewhere).
 */
export type ChainId = 'solana' | 'sol' | 'ethereum' | 'base' | 'bnb' | 'arbitrum'

/**
 * Chain-agnostic enrichment port — wraps on-chain / indexer fetches per network.
 * Scanner scoring stays chain-agnostic; ports supply normalized body fields.
 */
export interface ChainDataPort {
  readonly chainId: ChainId
  validateAddress(address: string): boolean
  enrich(body: Record<string, unknown>): Promise<Record<string, unknown>>
}

const SOLANA_BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/
const EVM_ADDR = /^0x[a-fA-F0-9]{40}$/

export class SolanaChainPort implements ChainDataPort {
  readonly chainId: ChainId = 'solana'

  validateAddress(address: string): boolean {
    const t = address.trim()
    if (t.startsWith('0x')) return false
    if (t.length < 32 || t.length > 44) return false
    return SOLANA_BASE58.test(t)
  }

  async enrich(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return enrichScanBodyFromChain(body)
  }
}

/**
 * EVM ChainDataPort — DexScreener market enrichment for 0x token addresses.
 * Does NOT run Solana scanner scoring. Callers must not treat this as a risk verdict.
 */
export class EvmChainPort implements ChainDataPort {
  readonly chainId: ChainId

  constructor(chainId: Exclude<ChainId, 'solana' | 'sol'> = 'ethereum') {
    this.chainId = chainId
  }

  validateAddress(address: string): boolean {
    return EVM_ADDR.test(address.trim())
  }

  async enrich(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const mint =
      typeof body.tokenAddress === 'string'
        ? body.tokenAddress.trim()
        : typeof body.mint === 'string'
          ? body.mint.trim()
          : ''
    if (!mint || !this.validateAddress(mint)) {
      return {
        ...body,
        chain: this.chainId,
        enrichmentFailed: true,
        enrichmentNote: 'Invalid EVM token address',
      }
    }

    try {
      // ~80–150ms estimated — DexScreener public token pairs
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        return {
          ...body,
          chain: this.chainId,
          mint,
          enrichmentFailed: true,
          enrichmentNote: `DexScreener ${res.status}`,
        }
      }
      const json = (await res.json()) as {
        pairs?: Array<{
          chainId?: string
          priceUsd?: string
          liquidity?: { usd?: number }
          volume?: { h24?: number }
          priceChange?: { h24?: number }
          baseToken?: { symbol?: string; name?: string; address?: string }
          fdv?: number
          marketCap?: number
        }>
      }
      const prefer = String(this.chainId === 'bnb' ? 'bsc' : this.chainId)
      const pairs = json.pairs ?? []
      const scoped = pairs.filter((p) => String(p.chainId || '').toLowerCase() === prefer)
      const pool = scoped.length ? scoped : pairs
      const best = [...pool].sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
      )[0]
      if (!best) {
        return {
          ...body,
          chain: this.chainId,
          mint,
          enrichmentFailed: true,
          enrichmentNote: 'No DexScreener pairs',
        }
      }
      return {
        ...body,
        chain: this.chainId,
        mint,
        enrichmentFailed: false,
        market: {
          priceUsd: Number(best.priceUsd ?? 0) || null,
          liquidityUsd: best.liquidity?.usd ?? null,
          volume24hUsd: best.volume?.h24 ?? null,
          change24hPct: best.priceChange?.h24 ?? null,
          fdvUsd: best.fdv ?? best.marketCap ?? null,
          symbol: best.baseToken?.symbol ?? null,
          name: best.baseToken?.name ?? null,
          source: 'dexscreener',
        },
        enrichmentNote:
          'EVM market enrichment only — Security Scanner risk scores remain Solana-path',
      }
    } catch (err) {
      return {
        ...body,
        chain: this.chainId,
        mint,
        enrichmentFailed: true,
        enrichmentNote: err instanceof Error ? err.message : 'EVM enrich failed',
      }
    }
  }
}

function normalizeChainId(raw: unknown): ChainId {
  const c = String(raw ?? 'solana')
    .toLowerCase()
    .trim()
  if (c === 'sol') return 'solana'
  if (c === 'solana') return 'solana'
  if (c === 'ethereum' || c === 'eth') return 'ethereum'
  if (c === 'base') return 'base'
  if (c === 'bnb' || c === 'bsc') return 'bnb'
  if (c === 'arbitrum' || c === 'arb') return 'arbitrum'
  throw new Error(`Unsupported chain: ${c}`)
}

/**
 * Resolves mint/tokenAddress from body and routes enrichment to the correct port.
 */
export class ChainRouter {
  private readonly ports: Map<string, ChainDataPort>

  constructor(
    ports: ChainDataPort[] = [
      new SolanaChainPort(),
      new EvmChainPort('ethereum'),
      new EvmChainPort('base'),
      new EvmChainPort('bnb'),
      new EvmChainPort('arbitrum'),
    ],
  ) {
    this.ports = new Map(ports.map((p) => [p.chainId, p]))
  }

  resolveChainId(body: Record<string, unknown>): ChainId {
    return normalizeChainId(body.chain)
  }

  getPort(chainId: ChainId): ChainDataPort {
    const port = this.ports.get(chainId)
    if (!port) throw new Error(`No ChainDataPort registered for ${chainId}`)
    return port
  }

  resolveMint(body: Record<string, unknown>): string {
    const token =
      typeof body.tokenAddress === 'string'
        ? body.tokenAddress.trim()
        : typeof body.mint === 'string'
          ? body.mint.trim()
          : ''
    return token
  }

  async enrich(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const chainId = this.resolveChainId(body)
    const port = this.getPort(chainId)
    const mint = this.resolveMint(body)
    if (mint && !port.validateAddress(mint)) {
      throw new Error(`Invalid ${chainId} address`)
    }
    return port.enrich({ ...body, chain: chainId, mint: mint || body.mint })
  }
}

/** Singleton router — Solana scoring path + EVM market enrichment ports. */
export const chainRouter = new ChainRouter([
  new SolanaChainPort(),
  new EvmChainPort('ethereum'),
  new EvmChainPort('base'),
  new EvmChainPort('bnb'),
  new EvmChainPort('arbitrum'),
])
