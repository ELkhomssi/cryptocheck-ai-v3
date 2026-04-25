/**
 * Curated deployment / behavior fingerprints for historical rug-pull archetypes.
 * Production: sync from Supabase or ops pipeline; weighted similarity in ScannerEngine.
 */
export type RugpullFingerprint = {
  id: string
  label: string
  /** Signals this archetype is known for (overlap drives similarity). */
  signals: string[]
  /** Optional narrative for explainability. */
  description: string
  baseWeight: number
}

export const KNOWN_RUGPULL_FINGERPRINTS: RugpullFingerprint[] = [
  {
    id: 'fp_liquidity_strip_v1',
    label: 'Liquidity strip & dump',
    signals: ['thin_liquidity', 'fresh_pool', 'high_creator_allocation', 'mint_authority_retained'],
    description: 'Early liquidity with majority insider allocation and mutable mint.',
    baseWeight: 1,
  },
  {
    id: 'fp_honeypot_sell_lock',
    label: 'Sell-restricted pool pattern',
    signals: ['suspicious_router', 'low_dex_verification', 'extreme_tax_or_blacklist'],
    description: 'Patterns consistent with sell-side restrictions or proxy routers.',
    baseWeight: 1.1,
  },
  {
    id: 'fp_rapid_unwrap_cluster',
    label: 'Coordinated unwrap / mixer trail',
    signals: ['mixer_funding_trail', 'linked_creator_cluster', 'behavioral_scam_links'],
    description: 'Creator funded via privacy/mixer paths with linked scam wallets.',
    baseWeight: 1.2,
  },
  {
    id: 'fp_copycat_metadata',
    label: 'Copycat metadata / authority churn',
    signals: ['metadata_update_churn', 'duplicate_symbol', 'proxy_mint'],
    description: 'Metadata or authorities churn typical of copycat launches.',
    baseWeight: 0.9,
  },
]
