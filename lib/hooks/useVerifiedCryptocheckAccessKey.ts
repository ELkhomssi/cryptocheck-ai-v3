'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CRYPTOCHECK_ACCESS_KEY_SYSTEM_EVENT,
  readCryptocheckAccessKeyFromLocalStorage,
} from '@/lib/auth/cryptocheck-access-key'

export type UseVerifiedCryptocheckAccessKeyResult = {
  /** First verify pass finished (success or failure). */
  ready: boolean
  /** True only after verify returned 200 with a valid key payload. */
  hasValidKey: boolean
  /** Re-run verify against current localStorage (e.g. after paste elsewhere). */
  recheck: () => Promise<void>
}

/**
 * Site-wide access: reads `cryptocheck_access_key`, verifies with `/api/v1/keys/verify`,
 * and re-runs when `cryptocheck-access-key-system-changed` fires.
 */
export function useVerifiedCryptocheckAccessKey(): UseVerifiedCryptocheckAccessKeyResult {
  const [ready, setReady] = useState(false)
  const [hasValidKey, setHasValidKey] = useState(false)

  const recheck = useCallback(async () => {
    const raw = readCryptocheckAccessKeyFromLocalStorage().trim()
    if (!raw) {
      setHasValidKey(false)
      setReady(true)
      return
    }
    try {
      const r = await fetch('/api/v1/keys/verify?scope=session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: raw }),
      })
      setHasValidKey(r.ok)
      if (process.env.NODE_ENV === 'development' && !r.ok) {
        const body = await r.clone().text().catch(() => '')
        console.debug('[access-key] verify not ok', r.status, body.slice(0, 200))
      }
    } catch {
      setHasValidKey(false)
      if (process.env.NODE_ENV === 'development') {
        console.debug('[access-key] verify request failed')
      }
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await recheck()
      if (cancelled) return
    })()
    const onSystem = () => {
      void recheck()
    }
    window.addEventListener(CRYPTOCHECK_ACCESS_KEY_SYSTEM_EVENT, onSystem)
    return () => {
      cancelled = true
      window.removeEventListener(CRYPTOCHECK_ACCESS_KEY_SYSTEM_EVENT, onSystem)
    }
  }, [recheck])

  return { ready, hasValidKey, recheck }
}
