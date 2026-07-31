/**
 * Terminal OS wallet session — Solana (adapter) + EVM (injected).
 * Read-only at connect; no execution permission requested here.
 */

export type WalletChainFamily = 'solana' | 'evm'

export type TerminalTokenBalance = {
  mint: string
  symbol: string
  amount: number
  valueUsd: number
}

export type TerminalWalletBalances = {
  nativeSymbol: string
  nativeAmount: number
  nativeUsd: number | null
  /** Token holdings when available (Solana via /api/portfolio/holdings). */
  tokens: TerminalTokenBalance[]
  totalValueUsd: number | null
  updatedAt: string
}

export type TerminalWalletSession = {
  connected: boolean
  address: string | null
  label: string | null
  chainFamily: WalletChainFamily | null
  balances: TerminalWalletBalances | null
}
