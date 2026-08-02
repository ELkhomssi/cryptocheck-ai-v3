'use client'

import { useTerminalWallet } from '@/features/terminal-os/wallet/useTerminalWallet'

export function AiOsWalletBar() {
  const { walletConnected, walletLabel, isConnecting, connectSolana, disconnect } =
    useTerminalWallet()

  if (walletConnected) {
    return (
      <button
        type="button"
        className="aios-wallet-btn"
        data-connected="true"
        disabled={isConnecting}
        onClick={() => void disconnect()}
        aria-label="Disconnect wallet"
      >
        {walletLabel ?? 'Connected'}
      </button>
    )
  }

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
