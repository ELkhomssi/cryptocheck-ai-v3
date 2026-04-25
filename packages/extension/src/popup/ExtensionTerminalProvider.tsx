import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type { KeyVerifySuccess, TokenIntelligenceReport } from '@/lib/types/intelligence'
import {
  initialTerminalState,
  terminalReducer,
  type TerminalAction,
  type TerminalState,
  type VerifiedKey,
} from '@/components/Dashboard/intelligence-terminal/terminal-reducer'
import { apiFetch } from '../lib/api-client'
import * as keyStore from '../lib/extension-key-store'

type Ctx = {
  state: TerminalState
  dispatch: Dispatch<TerminalAction>
  verifyKey: (raw: string) => Promise<void>
  clearKey: () => Promise<void>
  scan: (mint: string, opts?: { fresh?: boolean }) => Promise<void>
}

function readVerifyJson(res: Response): Promise<unknown> {
  return res.text().then((t) => {
    if (!t) return null
    try {
      return JSON.parse(t) as unknown
    } catch {
      return null
    }
  })
}

function scanErrorMessage(status: number, _body: unknown): string {
  if (status === 403) return 'Subscription required for this operation.'
  if (status === 404) return 'Token not found or has no upstream data.'
  if (status === 429) return 'Too many requests. Slow down and try again.'
  if (status >= 500) return 'Intelligence service is temporarily unavailable. Try again shortly.'
  if (status >= 400) return 'Request could not be completed.'
  return 'Something went wrong.'
}

const ExtensionTerminalContext = createContext<Ctx | null>(null)

function toVerifiedKey(raw: string, data: KeyVerifySuccess): VerifiedKey {
  return {
    raw,
    masked: keyStore.maskKey(raw),
    keyTier: data.keyTier,
    keyName: data.keyName,
    subscriptionTier: data.subscriptionTier,
    rateLimit: data.rateLimit,
  }
}

export function ExtensionTerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(terminalReducer, initialTerminalState)

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      dispatch({ type: 'HYDRATE_START' })
      let cryptoWarning: 'weak' | 'stale' | null = null
      if (!keyStore.isStrongCryptoAvailable) cryptoWarning = 'weak'

      const loaded = await keyStore.loadEncryptedKey()
      if (!loaded && (await keyStore.isCurrentKeyEncrypted())) {
        cryptoWarning = 'stale'
      }

      if (!loaded) {
        if (!cancelled) dispatch({ type: 'HYDRATE_COMPLETE', key: null, history: [], cryptoWarning })
        return
      }

      try {
        const res = await apiFetch('/api/v1/keys/verify', {
          method: 'POST',
          body: JSON.stringify({ key: loaded }),
        })
        if (cancelled) return
        if (res.status === 401) {
          await keyStore.clearKey()
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history: [], cryptoWarning })
          return
        }
        if (res.status === 429) {
          const j = (await res.json().catch(() => ({}))) as { retryAfter?: number }
          const retryAfter = typeof j.retryAfter === 'number' ? j.retryAfter : 60
          dispatch({ type: 'RATE_LIMITED', retryAfter })
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history: [], cryptoWarning })
          return
        }
        if (!res.ok) {
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history: [], cryptoWarning })
          return
        }
        const data = (await res.json()) as Partial<KeyVerifySuccess> | null
        if (
          !data ||
          data.valid !== true ||
          (data.keyTier !== 'v1' && data.keyTier !== 'v2') ||
          typeof data.keyName !== 'string' ||
          !data.rateLimit ||
          typeof data.rateLimit.maxRequests !== 'number' ||
          typeof data.rateLimit.windowSeconds !== 'number' ||
          (data.subscriptionTier !== 'FREE' &&
            data.subscriptionTier !== 'PRO' &&
            data.subscriptionTier !== 'ENTERPRISE')
        ) {
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history: [], cryptoWarning })
          return
        }
        const key = toVerifiedKey(loaded, data as KeyVerifySuccess)
        dispatch({ type: 'HYDRATE_COMPLETE', key, history: [], cryptoWarning })
      } catch {
        if (!cancelled) dispatch({ type: 'HYDRATE_COMPLETE', key: null, history: [], cryptoWarning })
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  const verifyKey = useCallback(async (raw: string) => {
    dispatch({ type: 'VERIFY_KEY_START' })
    const trimmed = raw.trim()
    if (!trimmed) {
      dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Invalid key' })
      return
    }
    try {
      const res = await apiFetch('/api/v1/keys/verify', {
        method: 'POST',
        body: JSON.stringify({ key: trimmed }),
      })
      if (res.status === 429) {
        const j = (await res.json().catch(() => ({}))) as { retryAfter?: number }
        const retryAfter = typeof j.retryAfter === 'number' ? j.retryAfter : 60
        dispatch({ type: 'RATE_LIMITED', retryAfter })
        dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Rate limited' })
        return
      }
      if (res.status === 401) {
        await keyStore.clearKey()
        dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Invalid key' })
        return
      }
      if (!res.ok) {
        dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Network error' })
        return
      }
      const data = (await res.json()) as Partial<KeyVerifySuccess> | null
      if (
        !data ||
        data.valid !== true ||
        (data.keyTier !== 'v1' && data.keyTier !== 'v2') ||
        typeof data.keyName !== 'string' ||
        !data.rateLimit
      ) {
        dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Invalid key' })
        return
      }
      await keyStore.storeEncryptedKey(trimmed)
      dispatch({ type: 'VERIFY_KEY_SUCCESS', key: toVerifiedKey(trimmed, data as KeyVerifySuccess) })
    } catch {
      dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Network error' })
    }
  }, [])

  const clearKey = useCallback(async () => {
    await keyStore.clearKey()
    dispatch({ type: 'CLEAR_KEY' })
  }, [])

  const scan = useCallback(
    async (mint: string, opts?: { fresh?: boolean }) => {
      const key = state.key
      if (!key) return
      const trimmed = mint.trim()
      if (!trimmed) return

      dispatch({ type: 'SCAN_START', mint: trimmed })

      try {
        const res = await apiFetch('/api/v1/intelligence/scan', {
          method: 'POST',
          rawKey: key.raw,
          body: JSON.stringify({
            mintAddress: trimmed,
            ...(opts?.fresh ? { fresh: true } : {}),
          }),
        })

        const body = await readVerifyJson(res)

        if (res.status === 401) {
          await keyStore.clearKey()
          dispatch({ type: 'CLEAR_KEY' })
          dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Session expired. Paste your key again.' })
          return
        }

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10) || 60
          dispatch({ type: 'RATE_LIMITED', retryAfter })
          dispatch({ type: 'SCAN_FAIL', error: 'Too many requests. Slow down and try again.' })
          return
        }

        if (!res.ok) {
          dispatch({ type: 'SCAN_FAIL', error: scanErrorMessage(res.status, body) })
          return
        }

        const report = body as TokenIntelligenceReport
        if (!report?.meta?.scanId || typeof report.mint !== 'string') {
          dispatch({ type: 'SCAN_FAIL', error: 'Unexpected response from the server.' })
          return
        }

        dispatch({ type: 'SCAN_SUCCESS', report })
        dispatch({
          type: 'ADD_TO_HISTORY',
          entry: {
            scanId: report.meta.scanId,
            mint: report.mint,
            verdict: report.riskVerdict ?? null,
            riskScore: report.riskScore ?? null,
            at: Date.now(),
          },
        })
      } catch {
        dispatch({ type: 'SCAN_FAIL', error: 'Network error. Check your connection.' })
      }
    },
    [state.key]
  )

  const value = useMemo(
    () => ({
      state,
      dispatch,
      verifyKey,
      clearKey,
      scan,
    }),
    [state, verifyKey, clearKey, scan]
  )

  return <ExtensionTerminalContext.Provider value={value}>{children}</ExtensionTerminalContext.Provider>
}

export function useExtensionTerminal(): Ctx {
  const ctx = useContext(ExtensionTerminalContext)
  if (!ctx) throw new Error('useExtensionTerminal must be used within ExtensionTerminalProvider')
  return ctx
}
