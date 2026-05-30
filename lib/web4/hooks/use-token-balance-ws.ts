'use client'

import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useCallback, useEffect, useState } from 'react'
import { baseToTokens } from '@/lib/web4/bonding-curve/math'

/** SPL balance for active mint via ATA `onAccountChange`. */
export function useTokenBalanceWs(mint: string | null) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [balance, setBalance] = useState(0)

  const refresh = useCallback(async () => {
    if (!publicKey || !mint) {
      setBalance(0)
      return
    }
    try {
      const mintPk = new PublicKey(mint)
      const ata = getAssociatedTokenAddressSync(mintPk, publicKey)
      const res = await connection.getTokenAccountBalance(ata, 'confirmed')
      setBalance(Number(res.value.uiAmount ?? 0))
    } catch {
      setBalance(0)
    }
  }, [connection, mint, publicKey])

  useEffect(() => {
    if (!publicKey || !mint) {
      setBalance(0)
      return
    }

    let cancelled = false
    let sub = 0

    void (async () => {
      try {
        const mintPk = new PublicKey(mint)
        const ata = getAssociatedTokenAddressSync(mintPk, publicKey)
        const info = await connection.getAccountInfo(ata, 'confirmed')
        if (info && !cancelled) {
          const amount = info.data.readBigUInt64LE(64)
          setBalance(baseToTokens(amount))
        } else if (!cancelled) {
          setBalance(0)
        }

        sub = connection.onAccountChange(
          ata,
          (acct) => {
            if (cancelled) return
            if (acct.data.length >= 72) {
              const amount = acct.data.readBigUInt64LE(64)
              setBalance(baseToTokens(amount))
            }
          },
          'confirmed',
        )
      } catch {
        if (!cancelled) setBalance(0)
      }
    })()

    return () => {
      cancelled = true
      if (sub) void connection.removeAccountChangeListener(sub)
    }
  }, [connection, mint, publicKey, refresh])

  return { tokenBalance: balance, refresh }
}
