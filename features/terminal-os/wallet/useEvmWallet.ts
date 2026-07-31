'use client'

/**
 * Minimal injected EVM connector (MetaMask / injected providers).
 * Read-only: eth_requestAccounts + eth_getBalance. No signing for execution.
 */

import { useCallback, useEffect, useState } from 'react'

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

function getInjected(): EthProvider | null {
  if (typeof window === 'undefined') return null
  const eth = (window as Window & { ethereum?: EthProvider }).ethereum
  return eth ?? null
}

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

async function fetchEthBalance(address: string): Promise<number> {
  const eth = getInjected()
  if (!eth) return 0
  const hex = (await eth.request({
    method: 'eth_getBalance',
    params: [address, 'latest'],
  })) as string
  const wei = BigInt(hex)
  return Number(wei) / 1e18
}

export function useEvmWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [nativeAmount, setNativeAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      const bal = await fetchEthBalance(addr)
      setNativeAmount(bal)
    } catch {
      setNativeAmount(0)
    }
  }, [])

  useEffect(() => {
    const eth = getInjected()
    if (!eth) return
    let cancelled = false
    void eth
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (cancelled) return
        const list = accounts as string[]
        const a = list[0] ?? null
        setAddress(a)
        if (a) void refreshBalance(a)
      })
      .catch(() => {})

    const onAccounts = (...args: unknown[]) => {
      const accounts = (args[0] as string[]) ?? []
      const a = accounts[0] ?? null
      setAddress(a)
      if (a) void refreshBalance(a)
      else setNativeAmount(0)
    }
    eth.on?.('accountsChanged', onAccounts)
    return () => {
      cancelled = true
      eth.removeListener?.('accountsChanged', onAccounts)
    }
  }, [refreshBalance])

  const connect = useCallback(async () => {
    const eth = getInjected()
    if (!eth) {
      setError('No injected EVM wallet found (install MetaMask or similar).')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      const a = accounts[0] ?? null
      setAddress(a)
      if (a) await refreshBalance(a)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'EVM connect failed')
    } finally {
      setConnecting(false)
    }
  }, [refreshBalance])

  const disconnect = useCallback(() => {
    setAddress(null)
    setNativeAmount(0)
    setError(null)
  }, [])

  return {
    address,
    shortAddr: address ? short(address) : '',
    isConnected: Boolean(address),
    isConnecting: connecting,
    nativeAmount,
    error,
    connect,
    disconnect,
    refreshBalance: () => (address ? refreshBalance(address) : Promise.resolve()),
  }
}
