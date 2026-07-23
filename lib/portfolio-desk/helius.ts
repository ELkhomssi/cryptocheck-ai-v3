import 'server-only'

import { getHeliusPrimaryRpcUrl } from '@/lib/helius-server'
import { SOL_MINT } from './constants'
import { cached } from './cache'

export type HeliusTokenHolding = {
  mint: string
  symbol: string
  name: string
  logoUrl: string | null
  amount: number
  decimals: number
  isNativeSol?: boolean
}

type DasAsset = {
  id?: string
  interface?: string
  content?: {
    metadata?: { name?: string; symbol?: string }
    links?: { image?: string }
    files?: Array<{ uri?: string; cdn_uri?: string }>
  }
  token_info?: {
    balance?: number
    decimals?: number
    symbol?: string
    price_info?: { price_per_token?: number }
  }
}

/**
 * Fetch SPL + SOL holdings via Helius DAS getAssetsByOwner.
 * Falls back to getParsedTokenAccountsByOwner when DAS fails.
 */
export async function fetchWalletHoldings(wallet: string): Promise<HeliusTokenHolding[]> {
  return cached(`helius:holdings:${wallet}`, 25_000, async () => {
    try {
      const das = await getAssetsByOwner(wallet)
      if (das.length) return das
    } catch {
      /* fall through */
    }
    return getParsedTokenAccounts(wallet)
  })
}

async function getAssetsByOwner(wallet: string): Promise<HeliusTokenHolding[]> {
  const rpc = getHeliusPrimaryRpcUrl()
  const holdings: HeliusTokenHolding[] = []
  let page = 1
  let solLamports = 0

  // Native SOL balance
  try {
    const balRes = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'sol-bal',
        method: 'getBalance',
        params: [wallet],
      }),
      cache: 'no-store',
    })
    const balBody = (await balRes.json()) as { result?: { value?: number } }
    solLamports = balBody.result?.value ?? 0
  } catch {
    solLamports = 0
  }

  if (solLamports > 0) {
    holdings.push({
      mint: SOL_MINT,
      symbol: 'SOL',
      name: 'Solana',
      logoUrl: null,
      amount: solLamports / 1e9,
      decimals: 9,
      isNativeSol: true,
    })
  }

  for (;;) {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `das-${page}`,
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: wallet,
          page,
          limit: 1000,
          displayOptions: {
            showFungible: true,
            showNativeBalance: false,
          },
        },
      }),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Helius DAS HTTP ${res.status}`)
    const body = (await res.json()) as {
      error?: { message?: string }
      result?: { items?: DasAsset[]; total?: number }
    }
    if (body.error) throw new Error(body.error.message || 'DAS error')
    const items = body.result?.items ?? []
    for (const a of items) {
      const mint = a.id
      if (!mint || mint === SOL_MINT) continue
      const decimals = a.token_info?.decimals ?? 0
      const rawBal = a.token_info?.balance ?? 0
      const amount = decimals > 0 ? rawBal / 10 ** decimals : rawBal
      if (!(amount > 0)) continue
      const symbol =
        a.token_info?.symbol || a.content?.metadata?.symbol || mint.slice(0, 4)
      const name = a.content?.metadata?.name || symbol
      const logoUrl =
        a.content?.links?.image ||
        a.content?.files?.[0]?.cdn_uri ||
        a.content?.files?.[0]?.uri ||
        null
      holdings.push({ mint, symbol, name, logoUrl, amount, decimals })
    }
    if (items.length < 1000) break
    page += 1
    if (page > 5) break
  }

  return holdings
}

async function getParsedTokenAccounts(wallet: string): Promise<HeliusTokenHolding[]> {
  const rpc = getHeliusPrimaryRpcUrl()
  const holdings: HeliusTokenHolding[] = []

  const balRes = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [wallet],
    }),
    cache: 'no-store',
  })
  const balBody = (await balRes.json()) as { result?: { value?: number } }
  const sol = (balBody.result?.value ?? 0) / 1e9
  if (sol > 0) {
    holdings.push({
      mint: SOL_MINT,
      symbol: 'SOL',
      name: 'Solana',
      logoUrl: null,
      amount: sol,
      decimals: 9,
      isNativeSol: true,
    })
  }

  const tokRes = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'getParsedTokenAccountsByOwner',
      params: [
        wallet,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ],
    }),
    cache: 'no-store',
  })
  const tokBody = (await tokRes.json()) as {
    result?: {
      value?: Array<{
        account: {
          data: {
            parsed?: {
              info?: {
                mint?: string
                tokenAmount?: { uiAmount?: number; decimals?: number }
              }
            }
          }
        }
      }>
    }
  }
  for (const row of tokBody.result?.value ?? []) {
    const info = row.account.data.parsed?.info
    const mint = info?.mint
    const amount = info?.tokenAmount?.uiAmount ?? 0
    const decimals = info?.tokenAmount?.decimals ?? 0
    if (!mint || !(amount > 0)) continue
    holdings.push({
      mint,
      symbol: mint.slice(0, 4),
      name: mint.slice(0, 4),
      logoUrl: null,
      amount,
      decimals,
    })
  }
  return holdings
}
