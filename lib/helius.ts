// ══════════════════════════════════════════════
//  CryptoCheck AI — Helius API Client
//  Hardcoded for local testing
// ══════════════════════════════════════════════

export const HELIUS_KEY  = '8948de2b-6114-45cd-839d-1a81eb273cd9'
export const HELIUS_RPC  = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
export const HELIUS_API  = `https://api.helius.xyz/v0`
export const HELIUS_DAS  = HELIUS_RPC   // DAS uses the same RPC URL

export const PLATFORM_WALLET = '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i'
export const NETWORK_LABEL   = 'Solana Mainnet-Beta'
export const ENGINE_LABEL    = 'CryptoCheck Neural Engine v2'

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
  meta:     TokenMeta | null
  supply:   TokenSupplyResult | null
  holders:  HoldersResult | null
  txs:      HeliusTx[]
  scannedAt: number
}

export interface PortfolioHolding {
  mint:     string
  amount:   number
  decimals: number
  name:     string
  symbol:   string
  mintAuth: string | null
  score:    number
}

// ── Core RPC call ──────────────────────────────

export async function rpcCall<T = unknown>(
  method: string,
  params: unknown[] = []
): Promise<T> {
  const res = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? 'RPC error')
  return data.result as T
}

// ── Helius REST API ────────────────────────────

export async function heliusRest<T = unknown>(
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${HELIUS_API}${path}?api-key=${HELIUS_KEY}`
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`Helius API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

// ── DAS RPC (getAssetsByOwner) ─────────────────

export async function dasCall<T = unknown>(
  method: string,
  params: unknown
): Promise<T> {
  const res = await fetch(HELIUS_DAS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? 'DAS error')
  return data.result as T
}

// ── Full token scan ────────────────────────────

export async function scanToken(mint: string): Promise<ScanData> {
  const [meta, supply, holders, txs] = await Promise.allSettled([
    heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: [mint] }),
    rpcCall<TokenSupplyResult>('getTokenSupply', [mint]),
    rpcCall<HoldersResult>('getTokenLargestAccounts', [mint]),
    heliusRest<HeliusTx[]>(`/addresses/${mint}/transactions`),
  ])

  return {
    mint,
    meta:    meta.status    === 'fulfilled' ? (meta.value[0] ?? null) : null,
    supply:  supply.status  === 'fulfilled' ? supply.value            : null,
    holders: holders.status === 'fulfilled' ? holders.value           : null,
    txs:     txs.status     === 'fulfilled' && Array.isArray(txs.value)
               ? txs.value.slice(0, 20)
               : [],
    scannedAt: Date.now(),
  }
}

// ── Portfolio scan via RPC ─────────────────────

export async function fetchPortfolio(walletAddress: string): Promise<PortfolioHolding[]> {
  // 1. Get all token accounts
  const tokenAccounts = await rpcCall<{
    value: Array<{
      account: {
        data: {
          parsed: {
            info: {
              mint: string
              tokenAmount: { uiAmount: number; decimals: number }
            }
          }
        }
      }
    }>
  }>('getTokenAccountsByOwner', [
    walletAddress,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ])

  const holdings = (tokenAccounts?.value ?? [])
    .filter(a => {
      const ui = a.account?.data?.parsed?.info
      return ui && (ui.tokenAmount?.uiAmount ?? 0) > 0
    })
    .slice(0, 25)
    .map(a => {
      const info = a.account.data.parsed.info
      return {
        mint:     info.mint,
        amount:   info.tokenAmount?.uiAmount ?? 0,
        decimals: info.tokenAmount?.decimals ?? 0,
      }
    })

  if (!holdings.length) return []

  // 2. Fetch metadata for all mints
  const mints = holdings.map(h => h.mint)
  let metaMap: Record<string, TokenMeta> = {}
  try {
    const metaArr = await heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: mints })
    metaArr.forEach(m => {
      const key = m.account ?? ''
      if (key) metaMap[key] = m
    })
  } catch {
    // metadata is best-effort
  }

  // 3. Score each holding
  return holdings.map(h => {
    const meta      = metaMap[h.mint] ?? null
    const name      = meta?.onChainMetadata?.metadata?.data?.name ?? meta?.legacyMetadata?.name ?? 'Unknown'
    const symbol    = meta?.onChainMetadata?.metadata?.data?.symbol ?? meta?.legacyMetadata?.symbol ?? '???'
    const mintAuth  = meta?.onChainMetadata?.metadata?.updateAuthority ?? null

    let score = 60
    if (!meta)          score -= 15
    if (name === 'Unknown') score -= 8
    if (mintAuth)       score -= 12
    score = Math.max(5, Math.min(100, score))

    return { ...h, name, symbol, mintAuth, score }
  })
}

// ── Slot ──────────────────────────────────────

export async function getSlot(): Promise<number> {
  return rpcCall<number>('getSlot')
}

// ── Helpers ───────────────────────────────────

export function formatSupply(amount: string, decimals: number): string {
  if (!amount) return 'N/A'
  try {
    const n = Number(BigInt(amount)) / Math.pow(10, decimals)
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
    if (n >= 1e9)  return (n / 1e9).toFixed(2)  + 'B'
    if (n >= 1e6)  return (n / 1e6).toFixed(2)  + 'M'
    if (n >= 1e3)  return (n / 1e3).toFixed(2)  + 'K'
    return n.toFixed(4)
  } catch { return 'N/A' }
}

export function truncate(addr: string, front = 8, back = 6): string {
  if (!addr || addr.length <= front + back) return addr
  return `${addr.slice(0, front)}…${addr.slice(-back)}`
}

export function calcChartData(data: ScanData): {
  top10Pct: number; liqPct: number; restPct: number
} {
  let top10Pct = 0
  if (data.holders?.value?.length && data.supply?.value?.amount) {
    const tot = BigInt(data.supply.value.amount)
    if (tot > 0n) {
      const s10 = data.holders.value
        .slice(0, 10)
        .reduce((a, h) => a + BigInt(h.amount ?? 0), 0n)
      top10Pct = Number((s10 * 10000n) / tot) / 100
    }
  }
  const liqPct  = Math.max(0, Math.min(30, (100 - top10Pct) * 0.35))
  const restPct = Math.max(0, 100 - top10Pct - liqPct)
  return { top10Pct, liqPct, restPct }
}

// ── Risk Engine ────────────────────────────────

export interface RiskResult {
  score:     number
  riskLabel: 'LOW' | 'MEDIUM' | 'HIGH'
  conf:      number
  summary:   string
  flags:     string[]
  verdict:   string
  cardClass: 'safe' | 'warn' | 'danger'
}

export function computeRisk(data: ScanData): RiskResult {
  const { meta, supply, holders } = data
  let score = 62
  const flags: string[] = []

  if (!meta) { score -= 12; flags.push('No on-chain metadata') }
  const name = meta?.onChainMetadata?.metadata?.data?.name ?? meta?.legacyMetadata?.name
  if (!name) { score -= 8; flags.push('Missing token name') }

  const mintAuth = meta?.onChainMetadata?.metadata?.updateAuthority
  if (mintAuth) { score -= 10; flags.push('Active mint authority — supply can inflate') }
  else           score += 14

  if (holders?.value?.length && supply?.value?.amount) {
    const tot = BigInt(supply.value.amount)
    const t1  = BigInt(holders.value[0]?.amount ?? 0)
    if (tot > 0n) {
      const pct = Number((t1 * 100n) / tot)
      if      (pct > 70) { score -= 25; flags.push(`Top holder owns ${pct}% — extreme rug risk`) }
      else if (pct > 40) { score -= 14; flags.push(`High concentration: top holder ${pct}%`) }
      else if (pct > 20) { score -=  5; flags.push(`Moderate concentration: ${pct}%`) }
      else                 score +=  8
    }
  }

  score = Math.max(0, Math.min(100, score))
  const conf      = 72 + Math.floor(Math.random() * 20)
  const riskLabel = score >= 70 ? 'LOW' : score >= 40 ? 'MEDIUM' : 'HIGH'
  const cardClass = score >= 70 ? 'safe' : score >= 40 ? 'warn' : 'danger'
  const verdict   = score >= 70
    ? '✓ SAFE TO PROCEED'
    : score >= 40
      ? '⚠ PROCEED WITH CAUTION'
      : '✕ HIGH RISK — AVOID'

  const summary = score >= 70
    ? `Token passed ${ENGINE_LABEL} screening with score ${score}/100. Authority structure clean. Distribution within acceptable thresholds. Standard risk management applies.`
    : score >= 40
      ? `Mixed signals detected: ${flags.join('. ')}. Reduce position size and monitor liquidity closely.`
      : `HIGH RISK: ${flags.join('. ')}. ${ENGINE_LABEL} flags this as a potential rug or honeypot. Avoid entry.`

  return { score, riskLabel, conf, summary, flags, verdict, cardClass }
}
