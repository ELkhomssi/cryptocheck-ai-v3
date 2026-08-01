'use client'

/**
 * Presentation mode preference — Simple (AI OS) vs Pro (Terminal).
 * Separate from Pro Mode store (stores/terminal-os.ts) — never edits that store.
 */

import { create } from 'zustand'

import type { UiPresentationMode } from '@/features/attention-feed/types'

const STORAGE_KEY = 'ccai:ui-mode'

function readStored(): UiPresentationMode {
  if (typeof window === 'undefined') return 'simple'
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'pro' || v === 'simple') return v
  } catch {
    /* ignore */
  }
  return 'simple'
}

function writeStored(mode: UiPresentationMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

/**
 * URL / admin force for Dubai booth:
 *   ?mode=pro | ?mode=simple | ?demo=pro
 * Forced modes do not overwrite the user's saved preference.
 */
export function resolveForcedModeFromSearch(search: string): UiPresentationMode | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const mode = (q.get('mode') || q.get('demo') || '').toLowerCase()
  if (mode === 'pro') return 'pro'
  if (mode === 'simple') return 'simple'
  return null
}

type ModeState = {
  mode: UiPresentationMode
  /** When true, URL forced the mode — don't persist overwrites from toggle until cleared */
  forced: boolean
  hydrated: boolean
  hydrate: (search: string) => void
  setMode: (mode: UiPresentationMode) => void
  toggle: () => void
}

export const usePresentationModeStore = create<ModeState>((set, get) => ({
  mode: 'simple',
  forced: false,
  hydrated: false,
  hydrate: (search: string) => {
    const forced = resolveForcedModeFromSearch(search)
    if (forced) {
      set({ mode: forced, forced: true, hydrated: true })
      return
    }
    set({ mode: readStored(), forced: false, hydrated: true })
  },
  setMode: (mode) => {
    const { forced } = get()
    if (!forced) writeStored(mode)
    set({ mode })
  },
  toggle: () => {
    const next = get().mode === 'simple' ? 'pro' : 'simple'
    get().setMode(next)
  },
}))
