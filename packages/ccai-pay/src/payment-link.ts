/**
 * Payment link builder — keep in sync with lib/payments/payment-link.ts
 * Browser-safe (no Node/process dependencies).
 */

export type PaymentLinkParams = {
  wallet: string
  amountUsd?: number
  token?: 'SOL' | 'USDC' | 'USDT'
  memo?: string
  chain?: string
}

const DEFAULT_ORIGIN = 'https://www.cryptocheckai.com'

function resolveOrigin(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, '')
  return DEFAULT_ORIGIN
}

export function buildPaymentLink(params: PaymentLinkParams & { baseUrl?: string }): string {
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

export function buildEmbedUrl(params: PaymentLinkParams & { baseUrl?: string }): string {
  const link = buildPaymentLink(params)
  return link.includes('?') ? `${link}&embed=true` : `${link}?embed=true`
}
