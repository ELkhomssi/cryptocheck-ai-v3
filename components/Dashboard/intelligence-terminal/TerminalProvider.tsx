'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { KeyVerifySuccess, TokenIntelligenceReport } from '@/lib/types/intelligence'
import {
  clearKey as clearStoredKey,
  isCurrentKeyEncrypted,
  isStrongCryptoAvailable,
  loadEncryptedKey,
  maskKey,
  storeEncryptedKey,
} from '@/lib/crypto/client-key-store'

export const TERMINAL_HISTORY_STORAGE_KEY = 'cc_terminal_history_v1'

export type TerminalPhase = 'idle' | 'verifying' | 'unlocked' | 'locked'

export type VerifiedKey = {
  raw: string
  masked: string
  keyTier: 'v1' | 'v2'
  keyName: string
  subscriptionTier: 'FREE' | 'PRO' | 'ENTERPRISE'
  rateLimit: { maxRequests: number; windowSeconds: number }
}

export type CurrentScan = {
  mint: string
  report: TokenIntelligenceReport | null
  status: 'idle' | 'loading' | 'error'
  error: string | null
}

export type Ticker = {
  mint: string
  price: number | null
  change24h: number | null
  volume24h: number | null
  updatedAt: number
}

export type HistoryEntry = {
  scanId: string
  mint: string
  verdict: string | null
  riskScore: number | null
  at: number
}

export type RateLimited = { retryAfter: number; until: number }

export type TerminalState = {
  phase: TerminalPhase
  key: VerifiedKey | null
  currentScan: CurrentScan | null
  ticker: Ticker | null
  history: HistoryEntry[]
  rateLimited: RateLimited | null
  hydrating: boolean
  cryptoWarning: 'weak' | 'stale' | null
  /** Last verify / auth error code for UI mapping (Gate). */
  verifyError: string | null
}

export type TerminalAction =
  | { type: 'HYDRATE_START' }
  | {
      type: 'HYDRATE_COMPLETE'
      key: VerifiedKey | null
      history: HistoryEntry[]
      cryptoWarning: 'weak' | 'stale' | null
    }
  | { type: 'VERIFY_KEY_START' }
  | { type: 'VERIFY_KEY_SUCCESS'; key: VerifiedKey }
  | { type: 'VERIFY_KEY_FAIL'; error: string }
  | { type: 'CLEAR_KEY' }
  | { type: 'LOCK' }
  | { type: 'UNLOCK' }
  | { type: 'SCAN_START'; mint: string }
  | { type: 'SCAN_SUCCESS'; report: TokenIntelligenceReport }
  | { type: 'SCAN_FAIL'; error: string }
  | { type: 'TICKER_UPDATE'; ticker: Ticker }
  | { type: 'ADD_TO_HISTORY'; entry: HistoryEntry }
  | { type: 'LOAD_HISTORY'; entries: HistoryEntry[] }
  | { type: 'RATE_LIMITED'; retryAfter: number }
  | { type: 'CLEAR_RATE_LIMIT' }

export const initialTerminalState: TerminalState = {
  phase: 'idle',
  key: null,
  currentScan: null,
  ticker: null,
  history: [],
  rateLimited: null,
  hydrating: false,
  cryptoWarning: null,
  verifyError: null,
}

function isVerifiedKeyLike(k: unknown): k is VerifiedKey {
  if (!k || typeof k !== 'object') return false
  const o = k as Record<string, unknown>
  return (
    typeof o.raw === 'string' &&
    typeof o.masked === 'string' &&
    (o.keyTier === 'v1' || o.keyTier === 'v2') &&
    typeof o.keyName === 'string' &&
    (o.subscriptionTier === 'FREE' || o.subscriptionTier === 'PRO' || o.subscriptionTier === 'ENTERPRISE') &&
    o.rateLimit !== null &&
    typeof o.rateLimit === 'object' &&
    typeof (o.rateLimit as { maxRequests?: unknown }).maxRequests === 'number' &&
    typeof (o.rateLimit as { windowSeconds?: unknown }).windowSeconds === 'number'
  )
}

/** Pure reducer — exported for unit tests. */
export function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'HYDRATE_START':
      return { ...state, hydrating: true }

    case 'HYDRATE_COMPLETE': {
      const history = Array.isArray(action.history) ? action.history.slice(0, 20) : []
      const cryptoWarning = action.cryptoWarning ?? null
      let key: VerifiedKey | null = null
      if (action.key != null && isVerifiedKeyLike(action.key)) {
        key = action.key
      }
      return {
        ...state,
        hydrating: false,
        phase: key ? 'unlocked' : 'idle',
        key,
        history,
        cryptoWarning,
        verifyError: null,
      }
    }

    case 'VERIFY_KEY_START':
      return { ...state, phase: 'verifying', verifyError: null }

    case 'VERIFY_KEY_SUCCESS':
      return {
        ...state,
        phase: 'unlocked',
        key: action.key,
        rateLimited: null,
        verifyError: null,
      }

    case 'VERIFY_KEY_FAIL':
      return {
        ...state,
        phase: 'idle',
        key: null,
        verifyError: action.error,
      }

    case 'CLEAR_KEY':
      return { ...initialTerminalState }

    case 'LOCK':
      if (!state.key) return state
      return { ...state, phase: 'locked' }

    case 'UNLOCK':
      if (!state.key) return state
      return { ...state, phase: 'unlocked' }

    case 'SCAN_START':
      return {
        ...state,
        currentScan: {
          mint: action.mint,
          report: null,
          status: 'loading',
          error: null,
        },
      }

    case 'SCAN_SUCCESS': {
      if (!state.currentScan) return state
      if (state.currentScan.mint !== action.report.mint) return state
      return {
        ...state,
        currentScan: {
          ...state.currentScan,
          report: action.report,
          status: 'idle',
          error: null,
        },
      }
    }

    case 'SCAN_FAIL':
      if (!state.currentScan) {
        return state
      }
      return {
        ...state,
        currentScan: {
          ...state.currentScan,
          status: 'error',
          error: action.error,
        },
      }

    case 'TICKER_UPDATE':
      return { ...state, ticker: action.ticker }

    case 'ADD_TO_HISTORY': {
      const next = [action.entry, ...state.history].slice(0, 20)
      return { ...state, history: next }
    }

    case 'LOAD_HISTORY':
      return { ...state, history: Array.isArray(action.entries) ? action.entries.slice(0, 20) : [] }

    case 'RATE_LIMITED': {
      const retryAfter = Math.max(1, action.retryAfter)
      return {
        ...state,
        rateLimited: { retryAfter, until: Date.now() + retryAfter * 1000 },
      }
    }

    case 'CLEAR_RATE_LIMIT':
      return { ...state, rateLimited: null }

    default:
      return state
  }
}

function toVerifiedKey(raw: string, data: KeyVerifySuccess): VerifiedKey {
  return {
    raw,
    masked: maskKey(raw),
    keyTier: data.keyTier,
    keyName: data.keyName,
    subscriptionTier: data.subscriptionTier,
    rateLimit: data.rateLimit,
  }
}

function parseHistoryFromStorage(raw: string | null): HistoryEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row): row is HistoryEntry => {
        if (!row || typeof row !== 'object') return false
        const o = row as Record<string, unknown>
        return (
          typeof o.scanId === 'string' &&
          typeof o.mint === 'string' &&
          (o.verdict === null || typeof o.verdict === 'string') &&
          (o.riskScore === null || typeof o.riskScore === 'number') &&
          typeof o.at === 'number'
        )
      })
      .slice(0, 20)
  } catch {
    return []
  }
}

function scanErrorMessage(status: number, _body: unknown): string {
  if (status === 403) return 'Subscription required for this operation.'
  if (status === 404) return 'Token not found or has no upstream data.'
  if (status === 429) return 'Too many requests. Slow down and try again.'
  if (status >= 500) return 'Intelligence service is temporarily unavailable. Try again shortly.'
  if (status >= 400) return 'Request could not be completed.'
  return 'Something went wrong.'
}

export type TerminalActions = {
  verifyKey: (raw: string) => Promise<void>
  clearKey: () => void
  lock: () => void
  unlock: () => void
  scan: (mint: string, opts?: { fresh?: boolean }) => Promise<void>
  scanTicker: (mint: string) => Promise<void>
  clearRateLimit: () => void
}

type TerminalContextValue = {
  state: TerminalState
  actions: TerminalActions
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

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

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(terminalReducer, initialTerminalState)

  useEffect(() => {
    try {
      window.localStorage.setItem(TERMINAL_HISTORY_STORAGE_KEY, JSON.stringify(state.history))
    } catch {
      /* ignore */
    }
  }, [state.history])

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      dispatch({ type: 'HYDRATE_START' })

      let history = parseHistoryFromStorage(
        typeof window !== 'undefined' ? window.localStorage.getItem(TERMINAL_HISTORY_STORAGE_KEY) : null
      )

      let cryptoWarning: 'weak' | 'stale' | null = null
      if (!isStrongCryptoAvailable) cryptoWarning = 'weak'

      const loaded = await loadEncryptedKey()
      if (!loaded && isCurrentKeyEncrypted()) {
        cryptoWarning = 'stale'
      }

      if (!loaded) {
        if (!cancelled) {
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history, cryptoWarning })
        }
        return
      }

      try {
        const res = await fetch('/api/v1/keys/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: loaded }),
        })

        if (cancelled) return

        if (res.status === 401) {
          clearStoredKey()
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history, cryptoWarning })
          return
        }

        if (res.status === 429) {
          const j = (await readVerifyJson(res)) as { retryAfter?: number } | null
          const retryAfter = typeof j?.retryAfter === 'number' ? j.retryAfter : 60
          dispatch({ type: 'RATE_LIMITED', retryAfter })
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history, cryptoWarning })
          return
        }

        if (!res.ok) {
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history, cryptoWarning })
          return
        }

        const data = (await readVerifyJson(res)) as Partial<KeyVerifySuccess> | null
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
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history, cryptoWarning })
          return
        }

        const key = toVerifiedKey(loaded, data as KeyVerifySuccess)
        dispatch({ type: 'HYDRATE_COMPLETE', key, history, cryptoWarning })
      } catch {
        if (!cancelled) {
          dispatch({ type: 'HYDRATE_COMPLETE', key: null, history, cryptoWarning })
        }
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
      const res = await fetch('/api/v1/keys/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed }),
      })

      if (res.status === 429) {
        const j = (await readVerifyJson(res)) as { retryAfter?: number } | null
        const retryAfter = typeof j?.retryAfter === 'number' ? j.retryAfter : 60
        dispatch({ type: 'RATE_LIMITED', retryAfter })
        dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Rate limited' })
        return
      }

      if (res.status === 401) {
        clearStoredKey()
        dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Invalid key' })
        return
      }

      if (!res.ok) {
        dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Network error' })
        return
      }

      const data = (await readVerifyJson(res)) as Partial<KeyVerifySuccess> | null
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

      await storeEncryptedKey(trimmed)
      const key = toVerifiedKey(trimmed, data as KeyVerifySuccess)
      dispatch({ type: 'VERIFY_KEY_SUCCESS', key })
    } catch {
      dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Network error' })
    }
  }, [])

  const clearKey = useCallback(() => {
    clearStoredKey()
    dispatch({ type: 'CLEAR_KEY' })
  }, [])

  const lock = useCallback(() => {
    dispatch({ type: 'LOCK' })
  }, [])

  const unlock = useCallback(() => {
    dispatch({ type: 'UNLOCK' })
  }, [])

  const clearRateLimit = useCallback(() => {
    dispatch({ type: 'CLEAR_RATE_LIMIT' })
  }, [])

  const scan = useCallback(
    async (mint: string, opts?: { fresh?: boolean }) => {
      const key = state.key
      if (!key) return
      const trimmed = mint.trim()
      if (!trimmed) {
        dispatch({ type: 'SCAN_FAIL', error: 'Enter a valid mint address.' })
        return
      }

      dispatch({ type: 'SCAN_START', mint: trimmed })

      try {
        const res = await fetch('/api/v1/intelligence/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key.raw}`,
          },
          body: JSON.stringify({
            mintAddress: trimmed,
            ...(opts?.fresh ? { fresh: true } : {}),
          }),
        })

        const body = await readVerifyJson(res)

        if (res.status === 401) {
          clearStoredKey()
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

  const scanTicker = useCallback(
    async (mint: string) => {
      const key = state.key
      if (!key) return
      const trimmed = mint.trim()
      if (!trimmed) return

      try {
        const res = await fetch('/api/v1/intelligence/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key.raw}`,
          },
          body: JSON.stringify({ mintAddress: trimmed, only: 'ticker' }),
        })

        const body = await readVerifyJson(res)

        if (res.status === 401) {
          clearStoredKey()
          dispatch({ type: 'CLEAR_KEY' })
          dispatch({ type: 'VERIFY_KEY_FAIL', error: 'Session expired. Paste your key again.' })
          return
        }

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10) || 60
          dispatch({ type: 'RATE_LIMITED', retryAfter })
          return
        }

        if (!res.ok) {
          return
        }

        const report = body as Partial<TokenIntelligenceReport>
        dispatch({
          type: 'TICKER_UPDATE',
          ticker: {
            mint: trimmed,
            price: typeof report.price === 'number' ? report.price : null,
            change24h: typeof report.priceChange24h === 'number' ? report.priceChange24h : null,
            volume24h: typeof report.volume24h === 'number' ? report.volume24h : null,
            updatedAt: Date.now(),
          },
        })
      } catch {
        /* silent for ticker poll */
      }
    },
    [state.key]
  )

  const actions = useMemo<TerminalActions>(
    () => ({
      verifyKey,
      clearKey,
      lock,
      unlock,
      scan,
      scanTicker,
      clearRateLimit,
    }),
    [verifyKey, clearKey, lock, unlock, scan, scanTicker, clearRateLimit]
  )

  const value = useMemo(() => ({ state, actions }), [state, actions])

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
}

export function useTerminal() {
  const ctx = useContext(TerminalContext)
  if (!ctx) {
    throw new Error('useTerminal must be used inside <TerminalProvider>')
  }
  return ctx
}
