/**
 * Terminal OS client UI state (Zustand).
 * Server/cache state stays in TanStack Query.
 */

import { create } from 'zustand'
import {
  DEFAULT_AUTONOMY_TIER,
  DEFAULT_FEATURE_FLAGS,
} from '@/features/terminal-os/shared/lib/feature-flags'
import type {
  AutonomyPermissionTier,
  ChainId,
  FeatureFlags,
  TerminalNavId,
  TokenRow,
} from '@/features/terminal-os/shared/types'
import type {
  TerminalWalletBalances,
  WalletChainFamily,
} from '@/features/terminal-os/wallet/types'
import { clearWalletDependentClientState } from '@/features/terminal-os/wallet/clear-dependent-state'

/** Minimal focus payload for Intelligence Chart (subset of TokenRow) */
export type FocusedToken = Pick<
  TokenRow,
  'id' | 'symbol' | 'name' | 'chain' | 'priceUsd' | 'logoUrl'
>

interface TerminalOsState {
  activeNav: TerminalNavId
  tokenChainTab: ChainId
  chartChainTab: ChainId
  focusedToken: FocusedToken | null
  walletConnected: boolean
  walletLabel: string | null
  walletAddress: string | null
  walletChainFamily: WalletChainFamily | null
  walletBalances: TerminalWalletBalances | null
  searchOpen: boolean
  searchQuery: string
  featureFlags: FeatureFlags
  autonomyTier: AutonomyPermissionTier
  notificationCount: number
  setActiveNav: (id: TerminalNavId) => void
  setTokenChainTab: (chain: ChainId) => void
  setChartChainTab: (chain: ChainId) => void
  setFocusedToken: (token: FocusedToken | null) => void
  setWalletConnected: (connected: boolean, label?: string | null) => void
  setWalletSession: (session: {
    connected: boolean
    address: string | null
    label: string | null
    chainFamily: WalletChainFamily | null
    balances?: TerminalWalletBalances | null
  }) => void
  setWalletBalances: (balances: TerminalWalletBalances | null) => void
  clearWalletSession: () => void
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (q: string) => void
  setNotificationCount: (n: number) => void
}

export const useTerminalOsStore = create<TerminalOsState>((set) => ({
  activeNav: 'terminal',
  tokenChainTab: 'all',
  chartChainTab: 'solana',
  focusedToken: null,
  walletConnected: false,
  walletLabel: null,
  walletAddress: null,
  walletChainFamily: null,
  walletBalances: null,
  searchOpen: false,
  searchQuery: '',
  featureFlags: { ...DEFAULT_FEATURE_FLAGS, realSwapExecution: true },
  autonomyTier: DEFAULT_AUTONOMY_TIER,
  notificationCount: 0,
  setActiveNav: (id) => set({ activeNav: id }),
  setTokenChainTab: (chain) => set({ tokenChainTab: chain }),
  setChartChainTab: (chain) => set({ chartChainTab: chain }),
  setFocusedToken: (token) => set({ focusedToken: token }),
  setWalletConnected: (connected, label = null) =>
    set({ walletConnected: connected, walletLabel: label }),
  setWalletSession: (session) =>
    set({
      walletConnected: session.connected,
      walletAddress: session.address,
      walletLabel: session.label,
      walletChainFamily: session.chainFamily,
      walletBalances: session.balances ?? null,
    }),
  setWalletBalances: (balances) => set({ walletBalances: balances }),
  clearWalletSession: () => {
    clearWalletDependentClientState()
    set({
      walletConnected: false,
      walletAddress: null,
      walletLabel: null,
      walletChainFamily: null,
      walletBalances: null,
      notificationCount: 0,
    })
  },
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setNotificationCount: (n) => set({ notificationCount: n }),
}))
