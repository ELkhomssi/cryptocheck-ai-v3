/** AI Trading Intelligence Terminal — separate from revenue-dashboard & intelligence-terminal. */

export const TERMINAL_BASE_PATH = '/terminal'

export const COMPLIANCE_DISCLAIMER =
  'Not financial advice · DYOR. CryptoCheck does not custody funds or keys.'

export const FEE_DISCLOSURE_PATH = '/legal/fees'
export const TERMS_PATH = '/legal/terms'

export const SOL_MINT = 'So11111111111111111111111111111111111111112'

/** Chart layout modes — primary desk is single-pane; multi retained for keyboard compat. */
export type ChartMode = 1 | 2 | 4 | 6

export const CHART_MODES: ChartMode[] = [1, 2, 4, 6]

/** Focus rebind UI budget from product spec. */
export const FOCUS_REBIND_BUDGET_MS = 200

/** localStorage keys — V1 layout/prefs (Supabase sync later). */
export const WORKSPACE_STORAGE_KEY = 'ccai:trading-terminal:workspace:v1'
export const WATCHLIST_STORAGE_KEY = 'ccai:trading-terminal:watchlists:v1'
export const COACH_MUTES_STORAGE_KEY = 'ccai:trading-terminal:coach-mutes:v1'
export const COACH_OVERRIDE_LOG_KEY = 'ccai:trading-terminal:coach-overrides:v1'
export const TRADE_LOG_KEY = 'ccai:trading-terminal:trades:v1'
export const SNIPER_STATE_KEY = 'ccai:trading-terminal:sniper:v1'

/** Soft-interrupt mute TTL (ms). BLOCKED can never be muted. */
export const COACH_MUTE_TTL_MS = 24 * 60 * 60 * 1000

/** Portfolio concentration soft-interrupt threshold (% of book). */
export const CONCENTRATION_INTERRUPT_PCT = 35

/** Behavioral detection windows. */
export const REVENGE_WINDOW_MS = 30 * 60 * 1000
export const WHIPLASH_WINDOW_MS = 3 * 60 * 1000
export const OVERRIDE_IGNORE_LOOKBACK = 10

/** Sniper: max risk score allowed when armed (abort at/above). */
export const SNIPER_DEFAULT_MAX_RISK = 70
export const SNIPER_DEFAULT_MAX_SOL = 1

/** HTML5 DnD mime for mint drops onto chart slots. */
export const TIT_DND_MIME = 'application/x-ccai-tit-mint'

/** Evidence coverage → display band (no fake precision %). */
export function coverageToBand(coverage: number): 'low' | 'medium' | 'high' {
  if (coverage >= 0.75) return 'high'
  if (coverage >= 0.45) return 'medium'
  return 'low'
}
