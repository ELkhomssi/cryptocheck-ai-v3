'use client'

/**
 * useConsoleShortcuts — Phase 4D
 *
 * Mounted by <Console />. Binds document-level listeners for:
 *
 *   ⌘/Ctrl + K           → focus the mint input (#intel-mint-input)
 *   ⌘/Ctrl + Shift + L   → actions.lock()
 *
 * Escape-to-clear is local to the input (see CommandLineInput).
 * Plain Enter already submits via the form.
 *
 * Listeners are installed exactly once per mount. Any keydown whose
 * target is inside a contentEditable element is ignored (so we never
 * fight other editors on the page).
 */

import { useEffect } from 'react'
import { useTerminal } from '../TerminalProvider'

export const MINT_INPUT_ID = 'intel-mint-input'

function isFromContentEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable
}

export function useConsoleShortcuts() {
  const { actions } = useTerminal()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isFromContentEditable(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      // ⌘K / Ctrl+K → focus input
      if (!e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        const el = document.getElementById(MINT_INPUT_ID) as
          | HTMLInputElement
          | null
        if (el) {
          e.preventDefault()
          el.focus()
          el.select()
        }
        return
      }

      // ⌘⇧L / Ctrl+Shift+L → lock
      if (e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        actions.lock()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [actions])
}
