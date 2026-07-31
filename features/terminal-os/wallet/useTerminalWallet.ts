'use client'

/**
 * Syncs real Solana + EVM wallet sessions into Terminal OS store.
 * Prefer Solana when both connected; disconnect clears dependent state.
 * Solana token balances reuse /api/portfolio/holdings (Helius + Jupiter).
 */

import { useCallback, useEffect } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useSolana } from '@/components/SolanaProvider'
import { handleMobileAwareWalletConnect } from '@/lib/solana/mobile-wallet-connect'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import { useEvmWallet } from './useEvmWallet'
import type { TerminalWalletBalances } from './types'

async function fetchSolBalance(
  connection: ReturnType<typeof useConnection>['connection'],
  address: string,
): Promise<number> {
  try {
    const lamports = await connection.getBalance(new PublicKey(address), 'confirmed')
    return lamports / LAMPORTS_PER_SOL
  } catch {
    return 0
  }
}

async function fetchSolHoldings(address: string): Promise<HoldingsResponse | null> {
  try {
    const res = await fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(address)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as HoldingsResponse
  } catch {
    return null
  }
}

function balancesFromHoldings(h: HoldingsResponse): TerminalWalletBalances {
  return {
    nativeSymbol: 'SOL',
    nativeAmount: h.availableSol,
    nativeUsd: h.availableSolUsd,
    tokens: h.holdings.slice(0, 40).map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      amount: t.amount,
      valueUsd: t.valueUsd,
    })),
    totalValueUsd: h.totalValueUsd,
    updatedAt: h.fetchedAt || new Date().toISOString(),
  }
}

export function useTerminalWallet() {
  const solana = useSolana()
  const evm = useEvmWallet()
  const { connection } = useConnection()
  const setWalletSession = useTerminalOsStore((s) => s.setWalletSession)
  const setWalletBalances = useTerminalOsStore((s) => s.setWalletBalances)
  const clearWalletSession = useTerminalOsStore((s) => s.clearWalletSession)
  const walletAddress = useTerminalOsStore((s) => s.walletAddress)
  const walletChainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const walletBalances = useTerminalOsStore((s) => s.walletBalances)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const walletLabel = useTerminalOsStore((s) => s.walletLabel)

  // Prefer Solana session when present
  useEffect(() => {
    if (solana.isConnected && solana.walletAddress) {
      const addr = solana.walletAddress
      setWalletSession({
        connected: true,
        address: addr,
        label: solana.shortAddr,
        chainFamily: 'solana',
      })
      void (async () => {
        const holdings = await fetchSolHoldings(addr)
        if (holdings) {
          setWalletBalances(balancesFromHoldings(holdings))
          return
        }
        const nativeAmount = await fetchSolBalance(connection, addr)
        setWalletBalances({
          nativeSymbol: 'SOL',
          nativeAmount,
          nativeUsd: null,
          tokens: [],
          totalValueUsd: null,
          updatedAt: new Date().toISOString(),
        })
      })()
      return
    }
    if (evm.isConnected && evm.address) {
      setWalletSession({
        connected: true,
        address: evm.address,
        label: evm.shortAddr,
        chainFamily: 'evm',
        balances: {
          nativeSymbol: 'ETH',
          nativeAmount: evm.nativeAmount,
          nativeUsd: null,
          tokens: [],
          totalValueUsd: null,
          updatedAt: new Date().toISOString(),
        },
      })
      return
    }
    // Neither connected — only clear if store still thinks we are
    if (walletConnected) clearWalletSession()
  }, [
    solana.isConnected,
    solana.walletAddress,
    solana.shortAddr,
    evm.isConnected,
    evm.address,
    evm.shortAddr,
    evm.nativeAmount,
    connection,
    setWalletSession,
    setWalletBalances,
    clearWalletSession,
    walletConnected,
  ])

  const connectSolana = useCallback(async () => {
    await handleMobileAwareWalletConnect(solana.connect)
  }, [solana])

  const connectEvm = useCallback(async () => {
    await evm.connect()
  }, [evm])

  const disconnect = useCallback(async () => {
    if (solana.isConnected) solana.disconnect()
    if (evm.isConnected) evm.disconnect()
    clearWalletSession()
  }, [solana, evm, clearWalletSession])

  return {
    walletConnected,
    walletAddress,
    walletLabel,
    walletChainFamily,
    walletBalances,
    isConnecting: solana.isConnecting || evm.isConnecting,
    evmError: evm.error,
    connectSolana,
    connectEvm,
    disconnect,
    solanaConnected: solana.isConnected,
    evmConnected: evm.isConnected,
  }
}
