'use client'

// ══════════════════════════════════════════════
//  SolanaProvider — Phantom Wallet Connection
//  No external wallet-adapter dependency needed:
//  uses window.solana directly for simplicity.
// ══════════════════════════════════════════════

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'

// ── Phantom window type ──

declare global {
  interface Window {
    solana?: {
      isPhantom: boolean
      connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>
      disconnect: () => Promise<void>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      off: (event: string, handler: (...args: unknown[]) => void) => void
      publicKey?: { toString(): string } | null
      isConnected?: boolean
    }
  }
}

// ── Context ──

interface SolanaContextValue {
  walletAddress: string | null
  isConnected:   boolean
  isConnecting:  boolean
  connect:       () => Promise<void>
  disconnect:    () => void
  shortAddr:     string
}

const SolanaContext = createContext<SolanaContextValue>({
  walletAddress: null,
  isConnected:   false,
  isConnecting:  false,
  connect:       async () => {},
  disconnect:    () => {},
  shortAddr:     '',
})

// ── Provider ──

export function SolanaProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnecting,  setIsConnecting]  = useState(false)

  // Auto-detect already-connected Phantom on load
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.solana?.isPhantom) return

    // Try silent re-connect (onlyIfTrusted)
    window.solana.connect({ onlyIfTrusted: true })
      .then(r => setWalletAddress(r.publicKey.toString()))
      .catch(() => {}) // not previously trusted — ignore

    // Listen for account changes
    const handleAccountChange = (pubkey: unknown) => {
      if (pubkey && typeof pubkey === 'object' && 'toString' in pubkey) {
        setWalletAddress((pubkey as { toString(): string }).toString())
      } else {
        setWalletAddress(null)
      }
    }
    window.solana.on('accountChanged', handleAccountChange)
    return () => { window.solana?.off('accountChanged', handleAccountChange) }
  }, [])

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return

    if (!window.solana?.isPhantom) {
      window.open('https://phantom.app/', '_blank')
      return
    }

    setIsConnecting(true)
    try {
      const resp = await window.solana.connect()
      setWalletAddress(resp.publicKey.toString())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[SolanaProvider] connect failed:', msg)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    window.solana?.disconnect().catch(() => {})
    setWalletAddress(null)
  }, [])

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : ''

  return (
    <SolanaContext.Provider value={{
      walletAddress,
      isConnected: !!walletAddress,
      isConnecting,
      connect,
      disconnect,
      shortAddr,
    }}>
      {children}
    </SolanaContext.Provider>
  )
}

// ── Hook ──

export function useSolana() {
  return useContext(SolanaContext)
}
