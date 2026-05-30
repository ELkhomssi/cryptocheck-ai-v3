'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useCallback, useEffect, useState } from 'react'
import { lamportsToSol } from '@/lib/web4/bonding-curve/math'

/** Live SOL balance via `onAccountChange` (no polling intervals). */
export function useSolBalanceWs() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [solBalance, setSolBalance] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setSolBalance(0)
      return
    }
    setLoading(true)
    try {
      const lamports = await connection.getBalance(publicKey, 'confirmed')
      setSolBalance(lamportsToSol(BigInt(lamports)))
    } finally {
      setLoading(false)
    }
  }, [connection, publicKey])

  useEffect(() => {
    if (!publicKey) {
      setSolBalance(0)
      return
    }

    let cancelled = false
    void refresh()

    const sub = connection.onAccountChange(
      publicKey,
      (acct) => {
        if (!cancelled) setSolBalance(lamportsToSol(BigInt(acct.lamports)))
      },
      'confirmed',
    )

    return () => {
      cancelled = true
      void connection.removeAccountChangeListener(sub)
    }
  }, [connection, publicKey, refresh])

  return { solBalance, loading, refresh }
}
