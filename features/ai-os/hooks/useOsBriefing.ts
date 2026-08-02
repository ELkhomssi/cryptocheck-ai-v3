'use client'

import { useCallback, useEffect, useState } from 'react'
import type { OsBriefing } from '../types'

export function useOsBriefing(wallet: string | null) {
  const [briefing, setBriefing] = useState<OsBriefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const qs = wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''
      const res = await fetch(`/api/terminal-os/os-briefing${qs}`, { cache: 'no-store' })
      const body = (await res.json()) as OsBriefing
      if (!res.ok && body.insufficient) {
        setBriefing(body)
        setError(body.message)
        return
      }
      if (!res.ok) throw new Error(body.message || 'Briefing unavailable')
      setBriefing(body)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Briefing unavailable')
    } finally {
      setLoading(false)
    }
  }, [wallet])

  useEffect(() => {
    void reload()
    const id = window.setInterval(() => void reload(), 30_000)
    return () => window.clearInterval(id)
  }, [reload])

  return { briefing, loading, error, reload }
}
