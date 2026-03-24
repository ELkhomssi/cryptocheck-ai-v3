'use client'
import { ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { createContext, useContext } from 'react'
import '@solana/wallet-adapter-react-ui/styles.css'

interface SolanaContextValue {
  walletAddress: string | null
  isConnected: boolean
  isConnecting: boolean
  shortAddr: string
}

const SolanaContext = createContext<SolanaContextValue>({
  walletAddress: null,
  isConnected: false,
  isConnecting: false,
  shortAddr: '',
})

function SolanaInner({ children }: { children: ReactNode }) {
  const { publicKey, connecting } = useWallet()
  const walletAddress = publicKey?.toString() ?? null
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : ''
  return (
    <SolanaContext.Provider value={{
      walletAddress,
      isConnected: !!walletAddress,
      isConnecting: connecting,
      shortAddr,
    }}>
      {children}
    </SolanaContext.Provider>
  )
}

export function SolanaProvider({ children }: { children: ReactNode }) {
  const endpoint = 'https://api.mainnet-beta.solana.com'
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], [])
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolanaInner>{children}</SolanaInner>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export function useSolana() {
  return useContext(SolanaContext)
}
