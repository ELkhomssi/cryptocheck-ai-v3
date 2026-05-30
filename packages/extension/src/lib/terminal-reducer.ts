/**
 * Pure terminal state machine — copied from components/Dashboard/intelligence-terminal/terminal-reducer.ts — keep in sync.
 */

import type { TokenIntelligenceReport } from '../types'

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
