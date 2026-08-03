'use client'

import { useTerminalWallet } from '@/features/terminal-os/wallet/useTerminalWallet'

/** Compact wallet control for the AI OS header. */
export function AiOsWalletBar() {
  const { walletConnected, walletAddress, connectSolana, isConnecting, walletBalances } =
    useTerminalWallet()

  if (!walletConnected) {
    return (
      <button
        type="button"
        className="aios-wallet-btn"
        disabled={isConnecting}
        onClick={() => void connectSolana()}
      >
        {isConnecting ? 'Connecting…' : 'Connect wallet'}
      </button>
    )
  }

  const short = walletAddress ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}` : '—'
  const usd =
    walletBalances?.totalValueUsd != null
      ? `$${Math.round(walletBalances.totalValueUsd).toLocaleString()}`
      : null

  return (
    <div className="aios-wallet-connected" title={walletAddress ?? undefined}>
      <span className="aios-wallet-dot" aria-hidden />
      <span>{short}</span>
      {usd ? <span className="aios-wallet-usd">{usd}</span> : null}
    </div>
  )
}
