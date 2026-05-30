import 'server-only'

import { enrichScanBodyFromChain } from '@/lib/services/scanner/solana-token-enrichment'

/** Supported chain identifiers for CCAI Connect routing. */
export type ChainId = 'solana' | 'sol'

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

export class SolanaChainPort implements ChainDataPort {
  readonly chainId: ChainId = 'solana'

  validateAddress(address: string): boolean {
    const t = address.trim()
    if (t.length < 32 || t.length > 44) return false
    return SOLANA_BASE58.test(t)
  }

  async enrich(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return enrichScanBodyFromChain(body)
  }
}

function normalizeChainId(raw: unknown): ChainId {
  const c = String(raw ?? 'solana')
    .toLowerCase()
    .trim()
  if (c === 'sol') return 'solana'
  if (c === 'solana') return 'solana'
  throw new Error(`Unsupported chain: ${c}`)
}

/**
 * Resolves mint/tokenAddress from body and routes enrichment to the correct port.
 */
export class ChainRouter {
  private readonly ports: Map<ChainId, ChainDataPort>

  constructor(ports: ChainDataPort[] = [new SolanaChainPort()]) {
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

/** Singleton router for API gateway (Solana-only today). */
export const chainRouter = new ChainRouter([new SolanaChainPort()])
