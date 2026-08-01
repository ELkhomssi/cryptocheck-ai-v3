'use client'

/**
 * Continuously evaluates active alert rules.
 * Prefers SSE for price/threshold push; poll path also feeds Decision confidence
 * so ai_signal rules fire on Decision Engine state (not a shadow score).
 */

import { useEffect, useRef } from 'react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useTickerQuotes } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import type { FiredAlert } from '@/lib/terminal-os/alert-types'

export function AlertEvaluateBridge() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const { data: quotes } = useTickerQuotes()
  const decisionGen = useRef(0)

  useEffect(() => {
    if (!wallet) return

    let es: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    let stopped = false
    let unsubDecision: (() => void) | null = null

    const emit = (fired: FiredAlert[]) => {
      for (const f of fired) {
        window.dispatchEvent(new CustomEvent('ccai:tos:alert', { detail: f }))
      }
    }

    const decisionSnapshot = () => {
      const state = getTradeLikeMeOrchestrator().getState({
        autonomousTrading: false,
        copyTrading: false,
        realSwapExecution: false,
      })
      const d = state.canonicalDecision
      if (!d) return {}
      return {
        aiConfidence: d.confidence,
        riskScore: d.risk,
        decisionAction: d.action,
      }
    }

    const pollOnce = async () => {
      if (stopped) return
      const prices: Record<string, number> = {}
      for (const q of quotes ?? []) {
        prices[q.symbol] = q.priceUsd
      }
      if (focused?.priceUsd && focused.id) prices[focused.id] = focused.priceUsd
      if (focused?.symbol && focused.priceUsd) prices[focused.symbol] = focused.priceUsd
      const decision = decisionSnapshot()
      // Allow Decision-only evaluate when prices empty (ai_signal rules)
      if (Object.keys(prices).length === 0 && decision.aiConfidence == null) return
      try {
        const res = await fetch('/api/terminal-os/alerts/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet, prices, ...decision }),
        })
        if (!res.ok) return
        const body = (await res.json()) as { fired?: FiredAlert[] }
        emit(body.fired ?? [])
      } catch {
        /* best-effort */
      }
    }

    const startPoll = () => {
      void pollOnce()
      poll = setInterval(() => void pollOnce(), 15_000)
    }

    try {
      es = new EventSource(
        `/api/terminal-os/alerts/stream?wallet=${encodeURIComponent(wallet)}`,
      )
      es.addEventListener('alert', (ev) => {
        try {
          const body = JSON.parse((ev as MessageEvent).data) as { fired?: FiredAlert[] }
          emit(body.fired ?? [])
        } catch {
          /* ignore */
        }
      })
      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED) {
          es.close()
          es = null
          if (!stopped) startPoll()
        }
      }
      // SSE covers prices; still poll Decision for ai_signal (client TLM state)
      startPoll()
    } catch {
      startPoll()
    }

    unsubDecision = getTradeLikeMeOrchestrator().bus.subscribe('DecisionMade', () => {
      decisionGen.current += 1
      void pollOnce()
    })

    return () => {
      stopped = true
      es?.close()
      if (poll) clearInterval(poll)
      unsubDecision?.()
    }
  }, [wallet, quotes, focused])

  return null
}
