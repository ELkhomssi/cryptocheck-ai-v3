/**
 * CryptoCheck AI — Contract / program fetch for AI stress testing.
 * Uses Helius RPC + REST; optional Solscan Pro API when SOLSCAN_API_KEY is set.
 */

import { buildHeliusRestUrl, getHeliusPrimaryRpcUrl } from '@/lib/helius-server'

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

export type ContractKind = 'program' | 'mint' | 'other'

export interface FetchedContractBundle {
  address: string
  kind: ContractKind
  owner: string
  executable: boolean
  lamports: number
  /** BPF / upgradeable program bytecode preview (hex), programs only */
  programBytecodePreviewHex?: string
  programBytecodeLength?: number
  /** Mint account (SPL) */
  mintAuthority: string | null
  freezeAuthority: string | null
  decimals: number | null
  supplyRaw: string | null
  /** Metadata from Helius DAS */
  tokenName?: string
  tokenSymbol?: string
  metadataUpdateAuthority?: string | null
  /** Top holder concentration */
  topHolderPct: number | null
  topHolders: { address: string; pct: number; uiAmount: number | null }[]
  /** Market */
  liquidityUsd: number | null
  pairAgeMinutes: number | null
  priceChange24h: number | null
  /** IDL / Solscan */
  idlJson: string | null
  solscanNote: string | null
  fetchedAt: string
}

/** 429 / 503: wait 1s and retry; up to 3 retries after the first failure (4 attempts total). */
const HELIUS_RETRY_BACKOFF_MS = 1000
const HELIUS_MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableHeliusHttpStatus(status: number): boolean {
  return status === 429 || status === 503
}

class HeliusRetryableError extends Error {
  constructor(public readonly status: number) {
    super(`Helius HTTP ${status}`)
    this.name = 'HeliusRetryableError'
  }
}

async function withHeliusRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (e) {
      const retryable =
        e instanceof HeliusRetryableError ||
        (e instanceof Error && /Helius API (429|503):/.test(e.message))
      if (retryable && attempt < HELIUS_MAX_RETRIES) {
        await sleep(HELIUS_RETRY_BACKOFF_MS)
        continue
      }
      throw e
    }
  }
}

async function rpcCallWithRetry<T>(method: string, params: unknown[] = []): Promise<T> {
  return withHeliusRetry(async () => {
    const res = await fetch(getHeliusPrimaryRpcUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (isRetryableHeliusHttpStatus(res.status)) {
      throw new HeliusRetryableError(res.status)
    }
    const data = await res.json()
    if (data.error) throw new Error(data.error.message ?? 'RPC error')
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`)
    return data.result as T
  })
}

async function heliusRestWithRetry<T>(path: string, body?: unknown): Promise<T> {
  return withHeliusRetry(async () => {
    const url = buildHeliusRestUrl(path)
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (isRetryableHeliusHttpStatus(res.status)) {
      throw new HeliusRetryableError(res.status)
    }
    if (!res.ok) {
      throw new Error(`Helius API ${res.status}: ${await res.text()}`)
    }
    return res.json() as Promise<T>
  })
}

function bufToHexPreview(b64: string, maxBytes = 192): { hex: string; length: number } {
  try {
    const raw = Buffer.from(b64, 'base64')
    const slice = raw.subarray(0, Math.min(maxBytes, raw.length))
    return { hex: slice.toString('hex'), length: raw.length }
  } catch {
    return { hex: '', length: 0 }
  }
}

async function trySolscanMeta(address: string): Promise<{ idlJson: string | null; note: string | null }> {
  const key = process.env.SOLSCAN_API_KEY
  if (!key) return { idlJson: null, note: null }
  try {
    const r = await fetch(`https://pro-api.solscan.io/v2.0/account/metadata?address=${address}`, {
      headers: { token: key, Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (!r.ok) return { idlJson: null, note: `Solscan HTTP ${r.status}` }
    const j = await r.json()
    const note = j?.success === false ? String(j?.message ?? 'Solscan error') : null
    const idl = j?.data?.idl ?? j?.idl ?? null
    return {
      idlJson: idl && typeof idl === 'object' ? JSON.stringify(idl) : typeof idl === 'string' ? idl : null,
      note,
    }
  } catch (e) {
    return { idlJson: null, note: e instanceof Error ? e.message : 'Solscan fetch failed' }
  }
}

async function fetchDexIntel(mint: string): Promise<{
  liquidityUsd: number | null
  pairAgeMinutes: number | null
  priceChange24h: number | null
}> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { next: { revalidate: 0 } })
    const j = await r.json()
    const pair = j?.pairs?.[0]
    if (!pair) return { liquidityUsd: null, pairAgeMinutes: null, priceChange24h: null }
    const liq = pair.liquidity?.usd ?? null
    const created = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 60000) : null
    const pc = pair.priceChange?.h24 ?? null
    return { liquidityUsd: typeof liq === 'number' ? liq : null, pairAgeMinutes: created, priceChange24h: pc }
  } catch {
    return { liquidityUsd: null, pairAgeMinutes: null, priceChange24h: null }
  }
}

/**
 * Fetch everything the Neural Engine needs for a simulated exploit / rug analysis.
 */
export async function fetchContractForStressTest(address: string): Promise<FetchedContractBundle> {
  const trimmed = address.trim()
  if (trimmed.length < 32) throw new Error('Invalid Solana address')

  const [accountInfo, solscanMeta] = await Promise.all([
    rpcCallWithRetry<{
      value: null | {
        lamports: number
        owner: string
        executable: boolean
        data?: {
          program?: string
          parsed?: { type?: string; info?: Record<string, unknown> }
        }
      }
    }>('getAccountInfo', [trimmed, { encoding: 'jsonParsed' }]),
    trySolscanMeta(trimmed),
  ])

  const acc = accountInfo?.value
  if (!acc) {
    return {
      address: trimmed,
      kind: 'other',
      owner: '',
      executable: false,
      lamports: 0,
      mintAuthority: null,
      freezeAuthority: null,
      decimals: null,
      supplyRaw: null,
      topHolderPct: null,
      topHolders: [],
      liquidityUsd: null,
      pairAgeMinutes: null,
      priceChange24h: null,
      idlJson: solscanMeta.idlJson,
      solscanNote: solscanMeta.note ?? 'Account not found on-chain',
      fetchedAt: new Date().toISOString(),
    }
  }

  const owner = acc.owner
  const executable = !!acc.executable
  const lamports = acc.lamports ?? 0

  // ── Executable program ──
  if (executable) {
    const raw = await rpcCallWithRetry<{
      value: null | {
        data: [string, string]
        executable: boolean
        owner: string
        lamports: number
      }
    }>('getAccountInfo', [trimmed, { encoding: 'base64' }])
    const val = raw?.value
    const b64 = val?.data?.[0] ?? ''
    const prev = bufToHexPreview(b64, 256)
    return {
      address: trimmed,
      kind: 'program',
      owner,
      executable: true,
      lamports,
      mintAuthority: null,
      freezeAuthority: null,
      decimals: null,
      supplyRaw: null,
      programBytecodePreviewHex: prev.hex,
      programBytecodeLength: prev.length,
      topHolderPct: null,
      topHolders: [],
      liquidityUsd: null,
      pairAgeMinutes: null,
      priceChange24h: null,
      idlJson: solscanMeta.idlJson,
      solscanNote: solscanMeta.note,
      fetchedAt: new Date().toISOString(),
    }
  }

  // ── Try SPL mint ──
  const parsed = acc.data?.parsed
  const isMint =
    (owner === TOKEN_PROGRAM || owner === TOKEN_2022) &&
    parsed?.type === 'mint' &&
    parsed?.info

  if (isMint && parsed?.info) {
    const info = parsed.info as {
      mintAuthority?: string | { address?: string }
      freezeAuthority?: string | { address?: string } | null
      decimals?: number
      isInitialized?: boolean
    }
    const mintAuth =
      info.mintAuthority === null || info.mintAuthority === undefined
        ? null
        : typeof info.mintAuthority === 'string'
          ? info.mintAuthority
          : typeof info.mintAuthority === 'object'
            ? (info.mintAuthority as { address?: string }).address ?? null
            : null
    const freezeAuth =
      info.freezeAuthority === null || info.freezeAuthority === undefined
        ? null
        : typeof info.freezeAuthority === 'string'
          ? info.freezeAuthority
          : (info.freezeAuthority as { address?: string }).address ?? null
    const decimals = typeof info.decimals === 'number' ? info.decimals : 9

    const [supplyRes, holdersRes, metaArr, dex] = await Promise.all([
      rpcCallWithRetry<{ value: { amount: string; decimals: number } | null }>('getTokenSupply', [trimmed]),
      rpcCallWithRetry<{ value: { address: string; amount: string; uiAmount: number | null }[] } | null>(
        'getTokenLargestAccounts',
        [trimmed]
      ),
      heliusRestWithRetry<unknown[]>('/token-metadata', { mintAccounts: [trimmed] }).catch(() => [] as unknown[]),
      fetchDexIntel(trimmed),
    ])

    const supplyRaw = supplyRes?.value?.amount ?? null
    const holderList = holdersRes?.value ?? []
    let topHolderPct: number | null = null
    const total = supplyRaw ? BigInt(supplyRaw) : 0n
    if (total > 0n && holderList.length) {
      topHolderPct = Number((BigInt(holderList[0]?.amount ?? '0') * 10000n) / total) / 100
    }

    const meta0 = Array.isArray(metaArr) && metaArr[0] ? (metaArr[0] as Record<string, unknown>) : null
    const onChain = meta0?.onChainMetadata as Record<string, unknown> | undefined
    const md = onChain?.metadata as Record<string, unknown> | undefined
    const data = md?.data as Record<string, unknown> | undefined
    const tokenName = (data?.name as string) || (meta0?.legacyMetadata as Record<string, unknown>)?.name as string | undefined
    const tokenSymbol = (data?.symbol as string) || (meta0?.legacyMetadata as Record<string, unknown>)?.symbol as string | undefined
    const metadataUpdateAuthority = (onChain?.metadata as Record<string, unknown>)?.updateAuthority as string | undefined

    const topHolders = holderList.slice(0, 10).map(h => ({
      address: h.address,
      pct: total > 0n ? Number((BigInt(h.amount ?? '0') * 10000n) / total) / 100 : 0,
      uiAmount: h.uiAmount,
    }))

    return {
      address: trimmed,
      kind: 'mint',
      owner,
      executable: false,
      lamports,
      mintAuthority: mintAuth,
      freezeAuthority: freezeAuth,
      decimals,
      supplyRaw,
      tokenName,
      tokenSymbol,
      metadataUpdateAuthority: metadataUpdateAuthority ?? null,
      topHolderPct,
      topHolders,
      liquidityUsd: dex.liquidityUsd,
      pairAgeMinutes: dex.pairAgeMinutes,
      priceChange24h: dex.priceChange24h,
      idlJson: solscanMeta.idlJson,
      solscanNote: solscanMeta.note,
      fetchedAt: new Date().toISOString(),
    }
  }

  // ── Other account types (LP vault, ATA, etc.) — still send raw owner + lamports ──
  return {
    address: trimmed,
    kind: 'other',
    owner,
    executable: false,
    lamports,
    mintAuthority: null,
    freezeAuthority: null,
    decimals: null,
    supplyRaw: null,
    topHolderPct: null,
    topHolders: [],
    liquidityUsd: null,
    pairAgeMinutes: null,
    priceChange24h: null,
    idlJson: solscanMeta.idlJson,
    solscanNote: solscanMeta.note,
    fetchedAt: new Date().toISOString(),
  }
}
