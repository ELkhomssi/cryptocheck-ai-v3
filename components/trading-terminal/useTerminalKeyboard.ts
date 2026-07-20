'use client'

import { useEffect, useRef } from 'react'
import { useTerminalFocus } from './TerminalFocusProvider'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'

type KeyboardOpts = {
  onTabVerdict?: () => void
  onTabRecord?: () => void
  onTabBrief?: () => void
  onTabBehavior?: () => void
  onTabOutcomes?: () => void
  onToggleHelp?: () => void
  onCloseOverlays?: () => void
  helpOpen?: boolean
}

/**
 * Keyboard map (Prompt 2 + 9): chart modes, ticket, coach tabs, help.
 */
export function useTerminalKeyboard(discoverRows: UnifiedSignal[], opts: KeyboardOpts = {}) {
  const focus = useTerminalFocus()
  const rowsRef = useRef(discoverRows)
  rowsRef.current = discoverRows
  const focusRef = useRef(focus)
  focusRef.current = focus
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const f = focusRef.current
      const o = optsRef.current
      const tag = (e.target as HTMLElement | null)?.tagName
      const editable =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
      if (editable && e.key !== 'Escape') return

      const meta = e.metaKey || e.ctrlKey

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        o.onToggleHelp?.()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        f.setPositionsOpen(false)
        o.onCloseOverlays?.()
        return
      }

      if (o.helpOpen) return

      if (e.key === '1' && !meta) {
        e.preventDefault()
        f.setChartMode(1)
        return
      }
      if (e.key === '2' && !meta) {
        e.preventDefault()
        f.setChartMode(2)
        return
      }
      if (e.key === '4' && !meta) {
        e.preventDefault()
        f.setChartMode(4)
        return
      }
      if (e.key === '6' && !meta) {
        e.preventDefault()
        f.setChartMode(6)
        return
      }
      if ((e.key === 'b' || e.key === 'B') && !meta) {
        e.preventDefault()
        f.setTicketSide('buy')
        return
      }
      if ((e.key === 's' || e.key === 'S') && !meta) {
        e.preventDefault()
        f.setTicketSide('sell')
        return
      }
      if ((e.key === 'c' || e.key === 'C') && !meta) {
        e.preventDefault()
        f.setCoachCollapsed(!f.coachCollapsed)
        return
      }
      if ((e.key === 'd' || e.key === 'D') && meta) {
        e.preventDefault()
        f.setDiscoverCollapsed(!f.discoverCollapsed)
        return
      }
      if ((e.key === 'p' || e.key === 'P') && !meta) {
        e.preventDefault()
        f.setPositionsOpen(!f.positionsOpen)
        return
      }
      if ((e.key === 'w' || e.key === 'W') && !meta) {
        e.preventDefault()
        f.cycleWatchlist()
        return
      }
      if ((e.key === 'v' || e.key === 'V') && !meta) {
        e.preventDefault()
        o.onTabVerdict?.()
        return
      }
      if ((e.key === 't' || e.key === 'T') && !meta) {
        e.preventDefault()
        o.onTabRecord?.()
        return
      }
      if ((e.key === 'r' || e.key === 'R') && !meta) {
        e.preventDefault()
        o.onTabBrief?.()
        return
      }
      if ((e.key === 'h' || e.key === 'H') && !meta) {
        e.preventDefault()
        o.onTabBehavior?.()
        return
      }
      if ((e.key === 'm' || e.key === 'M') && !meta) {
        e.preventDefault()
        o.onTabOutcomes?.()
        return
      }
      if (e.key === 'ArrowDown' && !meta) {
        e.preventDefault()
        const n = rowsRef.current.length
        if (!n) return
        f.setDiscoverHighlight(Math.min(f.discoverHighlight + 1, n - 1))
        return
      }
      if (e.key === 'ArrowUp' && !meta) {
        e.preventDefault()
        f.setDiscoverHighlight(Math.max(f.discoverHighlight - 1, 0))
        return
      }
      if (e.key === 'Enter' && !meta) {
        const row = rowsRef.current[f.discoverHighlight]
        if (row?.contractAddress) {
          e.preventDefault()
          f.selectSignal(row)
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
