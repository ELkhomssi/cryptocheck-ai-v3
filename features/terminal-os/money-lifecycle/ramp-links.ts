/**
 * Non-custodial on/off-ramp link builder.
 * Funds always go to / from the user's connected wallet via a licensed provider.
 * No API key → honest needs_config (never a fake balance or mock widget).
 */

import type { RampProviderConfig } from './types'

function env(name: string): string {
  if (typeof process === 'undefined') return ''
  return (process.env[name] || '').trim()
}

/**
 * Build buy/sell URLs for the first configured licensed provider.
 * Priority: MoonPay → Transak → Ramp Network.
 * Optional `usdAmount` pre-fills exact shortfall for mid-swap funding.
 */
export function resolveRampConfig(
  walletAddress: string | null,
  opts?: { usdAmount?: number },
): RampProviderConfig {
  const addr = walletAddress?.trim() || ''
  const usd =
    typeof opts?.usdAmount === 'number' && Number.isFinite(opts.usdAmount) && opts.usdAmount > 0
      ? Math.round(opts.usdAmount * 100) / 100
      : null

  const moonpay = env('NEXT_PUBLIC_MOONPAY_API_KEY')
  if (moonpay) {
    const buy = new URL('https://buy.moonpay.com/')
    buy.searchParams.set('apiKey', moonpay)
    buy.searchParams.set('baseCurrencyCode', 'usd')
    buy.searchParams.set('currencyCode', 'sol')
    if (addr) buy.searchParams.set('walletAddress', addr)
    if (usd != null) buy.searchParams.set('baseCurrencyAmount', String(usd))

    const sell = new URL('https://sell.moonpay.com/')
    sell.searchParams.set('apiKey', moonpay)
    sell.searchParams.set('baseCurrencyCode', 'sol')
    if (addr) sell.searchParams.set('walletAddress', addr)

    return { provider: 'moonpay', buyUrl: buy.toString(), sellUrl: sell.toString(), configured: true }
  }

  const transak = env('NEXT_PUBLIC_TRANSAK_API_KEY')
  if (transak) {
    const buy = new URL('https://global.transak.com/')
    buy.searchParams.set('apiKey', transak)
    buy.searchParams.set('cryptoCurrencyCode', 'SOL')
    buy.searchParams.set('network', 'solana')
    buy.searchParams.set('productsAvailed', 'BUY')
    if (addr) buy.searchParams.set('walletAddress', addr)
    if (usd != null) buy.searchParams.set('fiatAmount', String(usd))

    const sell = new URL('https://global.transak.com/')
    sell.searchParams.set('apiKey', transak)
    sell.searchParams.set('cryptoCurrencyCode', 'SOL')
    sell.searchParams.set('network', 'solana')
    sell.searchParams.set('productsAvailed', 'SELL')
    if (addr) sell.searchParams.set('walletAddress', addr)

    return { provider: 'transak', buyUrl: buy.toString(), sellUrl: sell.toString(), configured: true }
  }

  const ramp = env('NEXT_PUBLIC_RAMP_API_KEY')
  if (ramp) {
    const buy = new URL('https://app.ramp.network/')
    buy.searchParams.set('hostApiKey', ramp)
    buy.searchParams.set('swapAsset', 'SOLANA_SOL')
    buy.searchParams.set('defaultAsset', 'SOLANA_SOL')
    if (addr) buy.searchParams.set('userAddress', addr)
    if (usd != null) buy.searchParams.set('fiatValue', String(usd))

    const sell = new URL('https://app.ramp.network/')
    sell.searchParams.set('hostApiKey', ramp)
    sell.searchParams.set('swapAsset', 'SOLANA_SOL')
    sell.searchParams.set('defaultFlow', 'OFFRAMP')
    if (addr) sell.searchParams.set('userAddress', addr)

    return { provider: 'ramp', buyUrl: buy.toString(), sellUrl: sell.toString(), configured: true }
  }

  return { provider: null, buyUrl: null, sellUrl: null, configured: false }
}
