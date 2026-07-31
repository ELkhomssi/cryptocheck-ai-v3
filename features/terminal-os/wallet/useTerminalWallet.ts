'use client'

/**
 * Syncs real Solana + EVM wallet sessions into Terminal OS store.
 * Prefer Solana when both connected; disconnect clears dependent state.
 */

import { useCallback, useEffect } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useSolana } from '@/components/SolanaProvider'
import { handleMobileAwareWalletConnect } from '@/lib/solana/mobile-wallet-connect'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useEvmWallet } from './useEvmWallet'

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
      setWalletSession({
        connected: true,
        address: solana.walletAddress,
        label: solana.shortAddr,
        chainFamily: 'solana',
      })
      void fetchSolBalance(connection, solana.walletAddress).then((nativeAmount) => {
        setWalletBalances({
          nativeSymbol: 'SOL',
          nativeAmount,
          nativeUsd: null,
          updatedAt: new Date().toISOString(),
        })
      })
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
