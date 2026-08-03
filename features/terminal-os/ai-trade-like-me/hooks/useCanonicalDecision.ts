'use client'

/**
 * Layer 4 read hook — identical Decision object from the server store.
 * No client-only Decision Engine state.
 */

import { useEffect, useState } from 'react'
import type { Decision } from '@cryptocheck/decision-contracts'
import { useTerminalOsStore } from '@/stores/terminal-os'

export function useCanonicalDecision(tokenId?: string | null): {
  decision: Decision | null
  decisions: Decision[]
  loading: boolean
} {
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const id = tokenId ?? focused?.id ?? focused?.symbol ?? null
  const [decision, setDecision] = useState<Decision | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const qs = new URLSearchParams()
        qs.set('limit', '16')
        if (wallet) qs.set('wallet', wallet)
        if (id) qs.set('token', id)
        const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('decisions unavailable')
        const body = (await res.json()) as {
          decision?: Decision | null
          decisions?: Decision[]
        }
        if (cancelled) return
        if (id) {
          setDecision(body.decision ?? null)
          setDecisions(body.decision ? [body.decision] : [])
        } else {
          const list = body.decisions ?? []
          setDecisions(list)
          setDecision(list[0] ?? null)
        }
      } catch {
        if (!cancelled) {
          setDecision(null)
          setDecisions([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 20_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [id, wallet])

  return { decision, decisions, loading }
}
