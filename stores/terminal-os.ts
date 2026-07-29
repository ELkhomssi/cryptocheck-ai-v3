/**
 * Terminal OS client UI state (Zustand).
 * Server/cache state stays in TanStack Query (Phase 2 wiring).
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

/** Minimal focus payload for Intelligence Chart (subset of TokenRow) */
export type FocusedToken = Pick<
  TokenRow,
  'id' | 'symbol' | 'name' | 'chain' | 'priceUsd' | 'logoUrl'
>

interface TerminalOsState {
  activeNav: TerminalNavId
  tokenChainTab: ChainId
  chartChainTab: ChainId
  /** Phase 22 — focused token opens Intelligence Chart */
  focusedToken: FocusedToken | null
  walletConnected: boolean
  walletLabel: string | null
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
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (q: string) => void
}

export const useTerminalOsStore = create<TerminalOsState>((set) => ({
  activeNav: 'terminal',
  tokenChainTab: 'all',
  chartChainTab: 'solana',
  focusedToken: null,
  walletConnected: false,
  walletLabel: null,
  searchOpen: false,
  searchQuery: '',
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
  autonomyTier: DEFAULT_AUTONOMY_TIER,
  notificationCount: 12,
  setActiveNav: (id) => set({ activeNav: id }),
  setTokenChainTab: (chain) => set({ tokenChainTab: chain }),
  setChartChainTab: (chain) => set({ chartChainTab: chain }),
  setFocusedToken: (token) => set({ focusedToken: token }),
  setWalletConnected: (connected, label = null) =>
    set({ walletConnected: connected, walletLabel: label }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))
