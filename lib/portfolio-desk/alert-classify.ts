import type { PortfolioAlert, PortfolioAlertType } from '@/types/portfolio-desk'

/** All alert types the terminal engine can emit (webhook + cron). */
export const ALL_ALERT_TYPES: PortfolioAlertType[] = [
  'whale',
  'liquidity',
  'dev_wallet',
  'smart_money',
  'risk',
  'whale_buy',
  'whale_sell',
  'liquidity_added',
  'liquidity_removed',
  'mint_authority',
  'freeze_authority',
  'rug_risk',
  'smart_money_entry',
  'smart_money_exit',
  'new_listing',
  'large_holder_distribution',
  'new_token_launch',
]

const EXPLICIT: Record<string, PortfolioAlertType> = {
  whale_buy: 'whale_buy',
  whale_sell: 'whale_sell',
  liquidity_added: 'liquidity_added',
  liquidity_removed: 'liquidity_removed',
  mint_authority: 'mint_authority',
  freeze_authority: 'freeze_authority',
  rug_risk: 'rug_risk',
  smart_money_entry: 'smart_money_entry',
  smart_money_exit: 'smart_money_exit',
  new_listing: 'new_listing',
  large_holder_distribution: 'large_holder_distribution',
  new_token_launch: 'new_token_launch',
  whale: 'whale',
  liquidity: 'liquidity',
  dev_wallet: 'dev_wallet',
  smart_money: 'smart_money',
  risk: 'risk',
}

/**
 * Classify a raw Helius / market event type string into PortfolioAlertType.
 * Prefer explicit snake_case names; fall back to keyword heuristics.
 */
export function classifyAlertType(typeRaw: string): PortfolioAlertType {
  const t = typeRaw.toLowerCase().trim().replace(/[\s-]+/g, '_')
  if (EXPLICIT[t]) return EXPLICIT[t]

  if (t.includes('new_token') || t.includes('token_launch') || t.includes('launch')) {
    return 'new_token_launch'
  }
  if (t.includes('new_listing') || t.includes('listing')) return 'new_listing'
  if (t.includes('holder_dist') || t.includes('large_holder') || t.includes('distribution')) {
    return 'large_holder_distribution'
  }
  if (t.includes('freeze')) return 'freeze_authority'
  if (t.includes('mint_auth') || (t.includes('mint') && t.includes('author'))) {
    return 'mint_authority'
  }
  if (t.includes('liq') && (t.includes('add') || t.includes('deposit'))) return 'liquidity_added'
  if (t.includes('liq') && (t.includes('remov') || t.includes('withdraw'))) {
    return 'liquidity_removed'
  }
  if (t.includes('liq')) return 'liquidity'
  if (t.includes('smart') && t.includes('exit')) return 'smart_money_exit'
  if (t.includes('smart') && (t.includes('entry') || t.includes('enter') || t.includes('buy'))) {
    return 'smart_money_entry'
  }
  if (t.includes('smart')) return 'smart_money'
  if (t.includes('rug') || t.includes('honeypot')) return 'rug_risk'
  if (t.includes('risk')) return 'risk'
  if (t.includes('dev')) return 'dev_wallet'
  if (t.includes('whale') && (t.includes('sell') || t.includes('out'))) return 'whale_sell'
  if (t.includes('whale') && (t.includes('buy') || t.includes('in'))) return 'whale_buy'
  if (t.includes('sell') && t.includes('transfer')) return 'whale_sell'
  if (t.includes('buy') && t.includes('transfer')) return 'whale_buy'
  return 'whale'
}

export function defaultTitleForType(type: PortfolioAlertType): string {
  switch (type) {
    case 'liquidity':
    case 'liquidity_added':
      return 'Liquidity added'
    case 'liquidity_removed':
      return 'Liquidity removed'
    case 'dev_wallet':
      return 'Dev wallet activity'
    case 'mint_authority':
      return 'Mint authority activity'
    case 'freeze_authority':
      return 'Freeze authority activity'
    case 'rug_risk':
    case 'risk':
      return 'High risk detected'
    case 'smart_money':
    case 'smart_money_entry':
      return 'Smart money entry'
    case 'smart_money_exit':
      return 'Smart money exit'
    case 'new_listing':
      return 'New listing'
    case 'new_token_launch':
      return 'New token launch'
    case 'large_holder_distribution':
      return 'Large holder distribution'
    case 'whale_buy':
      return 'Whale buy'
    case 'whale_sell':
      return 'Whale sell'
    case 'whale':
    default:
      return 'Whale activity'
  }
}

export function severityForType(type: PortfolioAlertType): PortfolioAlert['severity'] {
  if (
    type === 'rug_risk' ||
    type === 'risk' ||
    type === 'mint_authority' ||
    type === 'freeze_authority'
  ) {
    return 'critical'
  }
  if (
    type === 'dev_wallet' ||
    type === 'liquidity_removed' ||
    type === 'whale_sell' ||
    type === 'smart_money_exit' ||
    type === 'large_holder_distribution'
  ) {
    return 'warning'
  }
  return 'info'
}

/** Dedupe id: signature + type (+ mint when present). */
export function alertDedupeId(parts: {
  signature?: string | null
  id?: string | null
  type: PortfolioAlertType
  mint?: string | null
}): string {
  const sig =
    (parts.signature && parts.signature.trim()) ||
    (parts.id && parts.id.trim()) ||
    `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const mint = parts.mint?.trim()
  return mint ? `${sig}:${parts.type}:${mint}` : `${sig}:${parts.type}`
}

export function normalizeWebhookEvent(ev: unknown): PortfolioAlert | null {
  if (!ev || typeof ev !== 'object') return null
  const e = ev as Record<string, unknown>
  const typeRaw = String(e.type ?? e.eventType ?? e.alertType ?? 'transfer')
  const type = classifyAlertType(typeRaw)

  const tokenSymbol =
    (typeof e.tokenSymbol === 'string' && e.tokenSymbol) ||
    (typeof e.symbol === 'string' && e.symbol) ||
    null
  const mint =
    (typeof e.mint === 'string' && e.mint) ||
    (typeof e.tokenAddress === 'string' && e.tokenAddress) ||
    null
  const description =
    (typeof e.description === 'string' && e.description) ||
    (typeof e.message === 'string' && e.message) ||
    JSON.stringify(e).slice(0, 180)
  const title =
    (typeof e.title === 'string' && e.title) || defaultTitleForType(type)

  const signature =
    (typeof e.signature === 'string' && e.signature) ||
    (typeof e.txSignature === 'string' && e.txSignature) ||
    null
  const rawId = typeof e.id === 'string' ? e.id : null

  return {
    id: alertDedupeId({ signature, id: rawId, type, mint }),
    type,
    title,
    description,
    severity: severityForType(type),
    tokenSymbol,
    mint,
    createdAt: new Date().toISOString(),
  }
}
