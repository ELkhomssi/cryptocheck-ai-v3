/**
 * Payment link builder/parser — the crypto equivalent of a Stripe payment link.
 * Isomorphic (no server-only): used by the merchant link page (client) and server.
 */

export type PaymentLinkParams = {
  wallet: string
  amountUsd?: number
  token?: 'SOL' | 'USDC' | 'USDT'
  memo?: string
  chain?: string
}

function resolveOrigin(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  const env =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.CRYPTOCHECK_BASE_URL?.trim() ||
    'https://www.cryptocheckai.com'
  return env.replace(/\/$/, '')
}

export function buildPaymentLink(
  params: PaymentLinkParams & { baseUrl?: string }
): string {
  const origin = resolveOrigin(params.baseUrl)
  const url = new URL(`${origin}/pay/${params.wallet}`)
  if (typeof params.amountUsd === 'number' && params.amountUsd > 0) {
    url.searchParams.set('amount', String(params.amountUsd))
  }
  if (params.token) url.searchParams.set('token', params.token)
  if (params.memo) url.searchParams.set('memo', params.memo)
  if (params.chain && params.chain !== 'solana') url.searchParams.set('chain', params.chain)
  return url.toString()
}

export function parsePaymentLink(url: string): PaymentLinkParams {
  const u = new URL(url)
  const segments = u.pathname.split('/').filter(Boolean)
  const payIdx = segments.indexOf('pay')
  const wallet = payIdx >= 0 ? segments[payIdx + 1] ?? '' : ''

  const amountRaw = u.searchParams.get('amount')
  const amountUsd = amountRaw != null && Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : undefined
  const tokenRaw = u.searchParams.get('token')
  const token = tokenRaw === 'SOL' || tokenRaw === 'USDC' || tokenRaw === 'USDT' ? tokenRaw : undefined

  return {
    wallet,
    amountUsd,
    token,
    memo: u.searchParams.get('memo') ?? undefined,
    chain: u.searchParams.get('chain') ?? undefined,
  }
}

export function buildEmbedCode(params: PaymentLinkParams & { baseUrl?: string }): string {
  const link = buildPaymentLink(params)
  const embedUrl = link.includes('?') ? `${link}&embed=true` : `${link}?embed=true`
  return `<iframe src="${embedUrl}" width="340" height="460" frameborder="0" style="border:0;border-radius:16px;overflow:hidden"></iframe>`
}
