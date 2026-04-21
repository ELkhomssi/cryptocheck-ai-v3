/**
 * Live portfolio + PnL — uses `trading_os_portfolios` (see supabase-trading-os-extension.sql).
 * Wallet connect + stream wiring: integrate with existing Phantom flow (additive).
 */
export type PortfolioRow = {
  mint: string
  entry_price_usd: number | null
  amount_ui: number | null
}
