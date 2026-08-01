'use client'

/**
 * Layer 4 read hook — canonical Decision only (no Layer 1 imports).
 */

import { useEffect, useState } from 'react'
import type { Decision } from '@cryptocheck/decision-contracts'
import { getTradeLikeMeOrchestrator } from '../engines/orchestrator'
import { toCanonicalDecision } from '../lib/to-canonical-decision'

export function useCanonicalDecision(): Decision | null {
  const [decision, setDecision] = useState<Decision | null>(null)

  useEffect(() => {
    const orch = getTradeLikeMeOrchestrator()
    const sync = () => {
      const state = orch.getState({
        autonomousTrading: false,
        copyTrading: false,
        realSwapExecution: false,
      })
      if (state.canonicalDecision) {
        setDecision(state.canonicalDecision)
        return
      }
      const src = state.currentOpportunity ?? state.lastDecision
      setDecision(src ? toCanonicalDecision(src) : null)
    }
    sync()
    return orch.bus.subscribe('DecisionMade', sync)
  }, [])

  return decision
}
