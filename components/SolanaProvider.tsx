'use client'
import { ReactNode, useMemo, useCallback, type ComponentType } from 'react'
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react'
import { WalletModalProvider, useWalletModal } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { createContext, useContext } from 'react'
import '@solana/wallet-adapter-react-ui/styles.css'
import { getClientSolanaRpcUrl } from '@/lib/helius'
import { useSiwsSession, type SiwsStatus } from '@/components/identity/useSiwsSession'

interface SolanaContextValue {
  walletAddress: string | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  shortAddr: string
  /** Phase 18 — stable SIWS identity */
  userId: string | null
  siwsStatus: SiwsStatus
  siwsAuthenticated: boolean
  siwsError: string | null
  signInSiws: () => Promise<boolean>
  signOutSiws: () => Promise<void>
}

const SolanaContext = createContext<SolanaContextValue>({
  walletAddress: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  shortAddr: '',
  userId: null,
  siwsStatus: 'idle',
  siwsAuthenticated: false,
  siwsError: null,
  signInSiws: async () => false,
  signOutSiws: async () => {},
})

function SolanaInner({ children }: { children: ReactNode }) {
  const { publicKey, connecting, disconnect: walletDisconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const siws = useSiwsSession()

  const walletAddress = publicKey?.toString() ?? null

  const connect = useCallback(async () => {
    setVisible(true)
  }, [setVisible])

  const disconnect = useCallback(() => {
    void siws.signOut()
  }, [siws])

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : ''

  return (
    <SolanaContext.Provider
      value={{
        walletAddress,
        isConnected: !!walletAddress,
        isConnecting: connecting || siws.status === 'challenging' || siws.status === 'signing',
        connect,
        disconnect,
        shortAddr,
        userId: siws.userId,
        siwsStatus: siws.status,
        siwsAuthenticated: siws.authenticated,
        siwsError: siws.error,
        signInSiws: siws.signIn,
        signOutSiws: siws.signOut,
      }}
    >
      {children}
    </SolanaContext.Provider>
  )
}

export function SolanaProvider({ children }: { children: ReactNode }) {
  // Route wallet-adapter through our clean in-origin proxy so no CryptoCheck
  // auth headers or cookies can leak to an external Solana RPC.
  // Prefer HELIUS_RPC_URL / NEXT_PUBLIC_HELIUS_RPC_URL via getClientSolanaRpcUrl().
  // Phantom + Solflare are explicit; Backpack (and other Wallet Standard wallets)
  // auto-register when the extension is installed — no separate adapter package.
  const endpoint = useMemo(() => getClientSolanaRpcUrl(), [])
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  )
  // wallet-adapter FC typings clash with @types/react ≥18.3 ReactNode; cast keeps runtime identical.
  const Conn = ConnectionProvider as ComponentType<{ endpoint: string; children?: ReactNode }>
  const Wallets = WalletProvider as ComponentType<{
    wallets: unknown[]
    autoConnect?: boolean
    children?: ReactNode
  }>
  const Modal = WalletModalProvider as ComponentType<{ children?: ReactNode }>
  return (
    <Conn endpoint={endpoint}>
      <Wallets wallets={wallets} autoConnect>
        <Modal>
          <SolanaInner>{children}</SolanaInner>
        </Modal>
      </Wallets>
    </Conn>
  )
}

export function useSolana() {
  return useContext(SolanaContext)
}
