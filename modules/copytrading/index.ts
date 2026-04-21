/**
 * Smart copy-trading — reads `trading_os_tracked_wallets`.
 * Execution: route to existing swap / sniper UI (no duplicate executor).
 */
export type TrackedWalletRow = {
  wallet: string
  win_rate: number | null
  avg_roi: number | null
  last_trade_at: string | null
  risk_score: number | null
}
