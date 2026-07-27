'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PortfolioTheme } from '@/types/portfolio-desk'

type ThemeState = {
  theme: PortfolioTheme
  setTheme: (t: PortfolioTheme) => void
  toggle: () => void
  hydrateDom: () => void
}

function applyDom(theme: PortfolioTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

export const usePortfolioTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyDom(theme)
        set({ theme })
      },
      toggle: () => {
        const cur = get().theme
        const next =
          cur === 'light' || cur === 'brass-light'
            ? cur === 'brass-light'
              ? 'brass'
              : 'dark'
            : cur === 'brass'
              ? 'brass-light'
              : 'light'
        applyDom(next)
        set({ theme: next })
      },
      hydrateDom: () => applyDom(get().theme),
    }),
    {
      name: 'ccai-portfolio-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyDom(state.theme)
      },
    },
  ),
)
