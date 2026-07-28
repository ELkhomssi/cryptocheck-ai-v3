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
} from '@/features/terminal-os/shared/types'

interface TerminalOsState {
  activeNav: TerminalNavId
  tokenChainTab: ChainId
  chartChainTab: ChainId
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
  setWalletConnected: (connected: boolean, label?: string | null) => void
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (q: string) => void
}

export const useTerminalOsStore = create<TerminalOsState>((set) => ({
  activeNav: 'terminal',
  tokenChainTab: 'all',
  chartChainTab: 'solana',
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
  setWalletConnected: (connected, label = null) =>
    set({ walletConnected: connected, walletLabel: label }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))
