/**
 * Independent, fast mint-authority kill-switch via Helius RPC.
 *
 * This does NOT re-implement the frozen scoring engine — it only reads the raw
 * on-chain SPL mint account (mint authority / freeze authority) so the Sniper
 * can hard-block a buy even if the app gateway is unavailable. Authoritative
 * scoring still comes from the gateway (see assess-client.ts).
 */

export type MintAuthorityCheck = {
  ok: boolean
  /** null = could not determine (RPC failure / non-SPL account). */
  mintAuthorityActive: boolean | null
  freezeAuthorityActive: boolean | null
  decimals: number | null
  detail: string
}

type RpcAccountInfo = {
  result?: {
    value?: {
      data?:
        | {
            parsed?: {
              info?: {
                mintAuthority?: string | null
                freezeAuthority?: string | null
                decimals?: number
              }
              type?: string
            }
            program?: string
          }
        | unknown
    } | null
  }
  error?: { code?: number; message?: string }
}

export async function checkMintAuthority(
  rpcUrl: string,
  mint: string,
  timeoutMs = 2_500,
): Promise<MintAuthorityCheck> {
  if (!rpcUrl) {
    return { ok: false, mintAuthorityActive: null, freezeAuthorityActive: null, decimals: null, detail: 'no HELIUS_API_KEY / rpc url' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'scanner-mint-authority',
        method: 'getAccountInfo',
        params: [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }],
      }),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!res.ok) {
      return { ok: false, mintAuthorityActive: null, freezeAuthorityActive: null, decimals: null, detail: `rpc HTTP ${res.status}` }
    }

    const json = (await res.json()) as RpcAccountInfo
    if (json.error) {
      return { ok: false, mintAuthorityActive: null, freezeAuthorityActive: null, decimals: null, detail: `rpc error ${json.error.code}: ${json.error.message}` }
    }

    const value = json.result?.value
    if (!value) {
      // Account not found → not a valid tradable mint.
      return { ok: true, mintAuthorityActive: null, freezeAuthorityActive: null, decimals: null, detail: 'mint account not found' }
    }

    const data = value.data as { parsed?: { info?: { mintAuthority?: string | null; freezeAuthority?: string | null; decimals?: number }; type?: string } }
    const info = data?.parsed?.info
    if (!info || data?.parsed?.type !== 'mint') {
      return { ok: false, mintAuthorityActive: null, freezeAuthorityActive: null, decimals: null, detail: 'account is not a parsed SPL mint' }
    }

    return {
      ok: true,
      mintAuthorityActive: info.mintAuthority != null,
      freezeAuthorityActive: info.freezeAuthority != null,
      decimals: typeof info.decimals === 'number' ? info.decimals : null,
      detail: 'ok',
    }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return {
      ok: false,
      mintAuthorityActive: null,
      freezeAuthorityActive: null,
      decimals: null,
      detail: aborted ? `rpc timeout (${timeoutMs}ms)` : e instanceof Error ? e.message : 'rpc failed',
    }
  } finally {
    clearTimeout(timer)
  }
}
