'use client'

/**
 * Simple Mode account control — "Secure Account" vocabulary only.
 * Opens the real wallet-adapter modal (Phantom / Solflare never disguised).
 */

import { startTransition } from 'react'
import { useTerminalWallet } from '@/features/terminal-os/wallet/useTerminalWallet'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { SIMPLE_VOCAB } from '../lib/vocab'

export function SimpleSecureAccount() {
  const { walletConnected, isConnecting, connectSolana, disconnect, walletLabel } =
    useTerminalWallet()
  const balances = useTerminalOsStore((s) => s.walletBalances)

  if (walletConnected) {
    return (
      <div className="sm-account">
        <span className="sm-account-bal">
          {balances?.totalValueUsd != null
            ? `$${balances.totalValueUsd.toFixed(0)} in your wallet`
            : walletLabel || 'Connected'}
        </span>
        <button
          type="button"
          className="sm-btn sm-btn-ghost"
          disabled={isConnecting}
          onClick={() => startTransition(() => void disconnect())}
        >
          {SIMPLE_VOCAB.disconnect}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="sm-btn sm-btn-primary"
      disabled={isConnecting}
      onClick={() => void connectSolana()}
    >
      {isConnecting ? 'Connecting…' : SIMPLE_VOCAB.connectWallet}
    </button>
  )
}
