/**
 * Terminal OS wallet session — Solana (adapter) + EVM (injected).
 * Read-only at connect; no execution permission requested here.
 */

export type WalletChainFamily = 'solana' | 'evm'

export type TerminalWalletBalances = {
  nativeSymbol: string
  nativeAmount: number
  nativeUsd: number | null
  updatedAt: string
}

export type TerminalWalletSession = {
  connected: boolean
  address: string | null
  label: string | null
  chainFamily: WalletChainFamily | null
  balances: TerminalWalletBalances | null
}
