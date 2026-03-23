'use client'
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'

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
    phantom?: {
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
}

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

function getProvider() {
  if (typeof window === 'undefined') return null
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana
  if (window.solana?.isPhantom) return window.solana
  return null
}

export function SolanaProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isConnecting,  setIsConnecting]  = useState(false)

  useEffect(() => {
    const provider = getProvider()
    if (!provider) return
    provider.connect({ onlyIfTrusted: true })
      .then(r => setWalletAddress(r.publicKey.toString()))
      .catch(() => {})
    const handleAccountChange = (pubkey: unknown) => {
      if (pubkey && typeof pubkey === 'object' && 'toString' in pubkey) {
        setWalletAddress((pubkey as { toString(): string }).toString())
      } else {
        setWalletAddress(null)
      }
    }
    provider.on('accountChanged', handleAccountChange)
    return () => { provider.off('accountChanged', handleAccountChange) }
  }, [])

  const connect = useCallback(async () => {
    const provider = getProvider()
    if (!provider) {
      window.open('https://phantom.app/', '_blank')
      return
    }
    setIsConnecting(true)
    try {
      const resp = await provider.connect()
      setWalletAddress(resp.publicKey.toString())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[SolanaProvider] connect failed:', msg)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    const provider = getProvider()
    provider?.disconnect().catch(() => {})
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

export function useSolana() {
  return useContext(SolanaContext)
}
