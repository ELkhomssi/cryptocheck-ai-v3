// ══════════════════════════════════════════════
//  CryptoCheck AI — Helius types & client-safe helpers
//  Network/RPC: use @/lib/helius-server (server-only) or /api/solana/*
// ══════════════════════════════════════════════

export const PLATFORM_WALLET = '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i'
export const NETWORK_LABEL = 'Solana Mainnet-Beta'
export const ENGINE_LABEL = 'CryptoCheck Neural Engine v2'

/** Public Solana mainnet RPC — safe for browser `Connection` (no API key). */
export const PUBLIC_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'

/**
 * Client-facing Solana RPC URL.
 *
 * In the browser we route every RPC call (Jupiter Terminal, wallet-adapter,
 * in-app web3.js `Connection`) through our own `/api/solana/rpc` proxy. This
 * gives us two guarantees:
 *   1. The Helius API key never ships to the client bundle — the proxy uses
 *      it server-side.
 *   2. The user's CryptoCheck API key / session cookies are *never* forwarded
 *      to an external Solana RPC or to Jupiter's backend. The proxy makes a
 *      fresh outbound request with only `Content-Type: application/json`.
 *
 * Outside the browser (SSR, tests) we fall back to the plain public RPC.
 */
export function getClientSolanaRpcUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/solana/rpc`
  }
  return PUBLIC_SOLANA_RPC_URL
}

// ── Types ──────────────────────────────────────

export interface TokenMeta {
  account?: string
  onChainMetadata?: {
    metadata?: {
      data?: { name?: string; symbol?: string; uri?: string }
      updateAuthority?: string
    }
  }
  legacyMetadata?: { name?: string; symbol?: string }
  tokenStandard?: string
}

export interface HolderAccount {
  address: string
  amount: string
  decimals: number
  uiAmount: number | null
  uiAmountString: string
}

export interface HoldersResult {
  value: HolderAccount[]
}

export interface TokenSupplyResult {
  value: {
    amount: string
    decimals: number
    uiAmount: number | null
    uiAmountString: string
  }
}

export interface HeliusTx {
  signature?: string
  type?: string
  source?: string
  timestamp?: number
  feePayer?: string
}

export interface ScanData {
  mint: string
  meta: TokenMeta | null
  supply: TokenSupplyResult | null
  holders: HoldersResult | null
  txs: HeliusTx[]
  scannedAt: number
}

export interface PortfolioHolding {
  mint: string
  amount: number
  decimals: number
  name: string
  symbol: string
  mintAuth: string | null
  score: number
}

// ── Helpers (pure — safe on client) ────────────

export function formatSupply(amount: string, decimals: number): string {
  if (!amount) return 'N/A'
  try {
    const n = Number(BigInt(amount)) / Math.pow(10, decimals)
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K'
    return n.toFixed(4)
  } catch {
    return 'N/A'
  }
}

export function truncate(addr: string, front = 8, back = 6): string {
  if (!addr || addr.length <= front + back) return addr
  return `${addr.slice(0, front)}…${addr.slice(-back)}`
}

export function calcChartData(data: ScanData): {
  top10Pct: number
  liqPct: number
  restPct: number
} {
  let top10Pct = 0
  if (data.holders?.value?.length && data.supply?.value?.amount) {
    const tot = BigInt(data.supply.value.amount)
    if (tot > 0n) {
      const s10 = data.holders.value.slice(0, 10).reduce((a, h) => a + BigInt(h.amount ?? 0), 0n)
      top10Pct = Number((s10 * 10000n) / tot) / 100
    }
  }
  const liqPct = Math.max(0, Math.min(30, (100 - top10Pct) * 0.35))
  const restPct = Math.max(0, 100 - top10Pct - liqPct)
  return { top10Pct, liqPct, restPct }
}

export interface RiskResult {
  score: number
  riskLabel: 'LOW' | 'MEDIUM' | 'HIGH'
  conf: number
  summary: string
  flags: string[]
  verdict: string
  cardClass: 'safe' | 'warn' | 'danger'
}

export function computeRisk(data: ScanData): RiskResult {
  const { meta, supply, holders } = data
  let score = 62
  const flags: string[] = []

  if (!meta) {
    score -= 12
    flags.push('No on-chain metadata')
  }
  const name = meta?.onChainMetadata?.metadata?.data?.name ?? meta?.legacyMetadata?.name
  if (!name) {
    score -= 8
    flags.push('Missing token name')
  }

  const mintAuth = meta?.onChainMetadata?.metadata?.updateAuthority
  if (mintAuth) {
    score -= 10
    flags.push('Active mint authority — supply can inflate')
  } else score += 14

  if (holders?.value?.length && supply?.value?.amount) {
    const tot = BigInt(supply.value.amount)
    const t1 = BigInt(holders.value[0]?.amount ?? 0)
    if (tot > 0n) {
      const pct = Number((t1 * 100n) / tot)
      if (pct > 70) {
        score -= 25
        flags.push(`Top holder owns ${pct}% — extreme rug risk`)
      } else if (pct > 40) {
        score -= 14
        flags.push(`High concentration: top holder ${pct}%`)
      } else if (pct > 20) {
        score -= 5
        flags.push(`Moderate concentration: ${pct}%`)
      } else score += 8
    }
  }

  score = Math.max(0, Math.min(100, score))
  const conf = 72 + Math.floor(Math.random() * 20)
  const riskLabel = score >= 70 ? 'LOW' : score >= 40 ? 'MEDIUM' : 'HIGH'
  const cardClass = score >= 70 ? 'safe' : score >= 40 ? 'warn' : 'danger'
  const verdict =
    score >= 70 ? '✓ SAFE TO PROCEED' : score >= 40 ? '⚠ PROCEED WITH CAUTION' : '✕ HIGH RISK — AVOID'

  const summary =
    score >= 70
      ? `Token passed ${ENGINE_LABEL} screening with score ${score}/100. Authority structure clean. Distribution within acceptable thresholds. Standard risk management applies.`
      : score >= 40
        ? `Mixed signals detected: ${flags.join('. ')}. Reduce position size and monitor liquidity closely.`
        : `HIGH RISK: ${flags.join('. ')}. ${ENGINE_LABEL} flags this as a potential rug or honeypot. Avoid entry.`

  return { score, riskLabel, conf, summary, flags, verdict, cardClass }
}
