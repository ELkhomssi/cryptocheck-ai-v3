'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useSolana } from '@/components/SolanaProvider'

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function RevenueWalletPill() {
  const { walletAddress, isConnected, isConnecting, connect, disconnect, shortAddr: ctxShort } =
    useSolana()
  const { connection } = useConnection()
  const [solBalance, setSolBalance] = useState<number | null>(null)

  const refreshBalance = useCallback(async () => {
    if (!walletAddress) {
      setSolBalance(null)
      return
    }
    try {
      const lamports = await connection.getBalance(new PublicKey(walletAddress))
      setSolBalance(lamports / 1e9)
    } catch {
      setSolBalance(null)
    }
  }, [connection, walletAddress])

  useEffect(() => {
    void refreshBalance()
    const id = window.setInterval(() => void refreshBalance(), 30_000)
    return () => window.clearInterval(id)
  }, [refreshBalance])

  if (!isConnected || !walletAddress) {
    return (
      <button
        type="button"
        onClick={() => void connect()}
        disabled={isConnecting}
        className="rounded-rd-sm border border-rd-green/40 bg-rd-green/10 px-4 py-2 font-rd-display text-[0.65rem] font-bold uppercase tracking-[0.12em] text-rd-green transition hover:bg-rd-green/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-green disabled:opacity-60"
      >
        {isConnecting ? 'Connecting…' : 'Connect wallet'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-rd-sm border border-white/10 bg-rd-panel/80 px-3 py-1.5">
      <span className="font-rd-mono text-xs tabular-nums text-rd-hi">
        {solBalance != null ? `${solBalance.toFixed(3)} SOL` : '— SOL'}
      </span>
      <span className="h-3 w-px bg-white/15" aria-hidden />
      <span className="font-rd-mono text-xs tabular-nums text-rd-mid" title={walletAddress}>
        {ctxShort || shortAddr(walletAddress)}
      </span>
      <button
        type="button"
        onClick={disconnect}
        className="ml-1 rounded px-1.5 py-0.5 font-rd-display text-[0.58rem] font-bold uppercase tracking-wider text-rd-lo hover:text-rd-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rd-danger"
      >
        Disconnect
      </button>
    </div>
  )
}
