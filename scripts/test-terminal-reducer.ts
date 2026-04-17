/**
 * Pure reducer tests for TerminalProvider (no React / DOM).
 */

import type { TokenIntelligenceReport } from '../lib/types/intelligence'
import {
  initialTerminalState,
  terminalReducer,
  type HistoryEntry,
  type TerminalAction,
  type TerminalState,
  type VerifiedKey,
} from '../components/dashboard/intelligence-terminal/TerminalProvider'

const sampleKey: VerifiedKey = {
  raw: 'cc_live_xxxxxxxx',
  masked: 'cc_live_xxxx...xxxx',
  keyTier: 'v1',
  keyName: 'Test',
  subscriptionTier: 'FREE',
  rateLimit: { maxRequests: 5, windowSeconds: 1 },
}

const sampleReport: TokenIntelligenceReport = {
  mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  name: 'Bonk',
  symbol: 'BONK',
  imageUrl: null,
  decimals: 5,
  supply: { raw: '1', ui: 1 },
  price: 1,
  priceChange24h: 0,
  marketCap: 1,
  volume24h: 1,
  liquidityUsd: 1,
  pairAgeDays: 1,
  meta: {
    scannedAt: new Date().toISOString(),
    cacheAge: 0,
    scanId: 'scan-1',
    keyTier: 'v1',
    subscriptionTier: 'FREE',
  },
}

function reduceAll(state: TerminalState, actions: TerminalAction[]): TerminalState {
  return actions.reduce((s, a) => terminalReducer(s, a), state)
}

let failed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    failed++
  }
}

function main() {
  let s = initialTerminalState

  // HYDRATE_START
  s = terminalReducer(s, { type: 'HYDRATE_START' })
  assert(s.hydrating === true, 'HYDRATE_START sets hydrating')

  // HYDRATE_COMPLETE with key
  const hist: HistoryEntry[] = [{ scanId: 'a', mint: 'm', verdict: null, riskScore: null, at: 1 }]
  s = terminalReducer(s, { type: 'HYDRATE_COMPLETE', key: sampleKey, history: hist, cryptoWarning: null })
  assert(s.phase === 'unlocked' && s.key === sampleKey && s.hydrating === false && s.history.length === 1, 'HYDRATE_COMPLETE unlocked')

  // VERIFY_KEY_START
  s = terminalReducer(s, { type: 'VERIFY_KEY_START' })
  assert(s.phase === 'verifying', 'VERIFY_KEY_START')

  // VERIFY_KEY_SUCCESS
  s = terminalReducer(s, { type: 'VERIFY_KEY_SUCCESS', key: sampleKey })
  assert(s.phase === 'unlocked' && s.rateLimited === null, 'VERIFY_KEY_SUCCESS')

  // VERIFY_KEY_FAIL
  s = terminalReducer(s, { type: 'VERIFY_KEY_FAIL', error: 'Invalid key' })
  assert(s.phase === 'idle' && s.key === null && s.verifyError === 'Invalid key', 'VERIFY_KEY_FAIL')

  // CLEAR_KEY
  s = terminalReducer(s, { type: 'CLEAR_KEY' })
  assert(
    s.phase === 'idle' &&
      s.key === null &&
      s.history.length === 0 &&
      s.currentScan === null &&
      s.verifyError === null,
    'CLEAR_KEY resets'
  )

  // LOCK / UNLOCK
  s = reduceAll(initialTerminalState, [
    { type: 'HYDRATE_COMPLETE', key: sampleKey, history: [], cryptoWarning: null },
    { type: 'LOCK' },
  ])
  assert(s.phase === 'locked', 'LOCK')
  s = terminalReducer(s, { type: 'UNLOCK' })
  assert(s.phase === 'unlocked', 'UNLOCK')

  // UNLOCK without key — no-op
  const beforeUnlock = initialTerminalState
  const afterUnlock = terminalReducer(beforeUnlock, { type: 'UNLOCK' })
  assert(afterUnlock === beforeUnlock, 'UNLOCK without key no-op')

  // SCAN flow
  s = reduceAll(initialTerminalState, [
    { type: 'HYDRATE_COMPLETE', key: sampleKey, history: [], cryptoWarning: null },
    { type: 'SCAN_START', mint: sampleReport.mint },
    { type: 'SCAN_SUCCESS', report: sampleReport },
  ])
  assert(s.currentScan?.report?.mint === sampleReport.mint && s.currentScan?.status === 'idle', 'SCAN_SUCCESS')

  // SCAN_SUCCESS with no currentScan
  s = terminalReducer(initialTerminalState, { type: 'SCAN_SUCCESS', report: sampleReport as never })
  assert(s.currentScan === null, 'SCAN_SUCCESS without currentScan no-op')

  // SCAN_FAIL
  s = reduceAll(initialTerminalState, [
    { type: 'HYDRATE_COMPLETE', key: sampleKey, history: [], cryptoWarning: null },
    { type: 'SCAN_START', mint: 'x' },
    { type: 'SCAN_FAIL', error: 'bad' },
  ])
  assert(s.currentScan?.status === 'error' && s.currentScan?.error === 'bad', 'SCAN_FAIL')

  // SCAN_FAIL without currentScan
  s = terminalReducer(initialTerminalState, { type: 'SCAN_FAIL', error: 'bad' })
  assert(s.currentScan === null, 'SCAN_FAIL without currentScan no-op')

  // TICKER_UPDATE
  s = terminalReducer(initialTerminalState, {
    type: 'TICKER_UPDATE',
    ticker: { mint: 'm', price: 1, change24h: 0, volume24h: 1, updatedAt: 1 },
  })
  assert(s.ticker?.mint === 'm', 'TICKER_UPDATE')

  // ADD_TO_HISTORY
  s = reduceAll(initialTerminalState, [
    { type: 'HYDRATE_COMPLETE', key: sampleKey, history: [], cryptoWarning: null },
    { type: 'ADD_TO_HISTORY', entry: { scanId: '1', mint: 'a', verdict: null, riskScore: null, at: 1 } },
    { type: 'ADD_TO_HISTORY', entry: { scanId: '2', mint: 'b', verdict: null, riskScore: null, at: 2 } },
  ])
  assert(s.history.length === 2 && s.history[0].mint === 'b', 'ADD_TO_HISTORY prepend cap')

  // LOAD_HISTORY
  const many = Array.from({ length: 25 }, (_, i) => ({
    scanId: String(i),
    mint: 'm',
    verdict: null as string | null,
    riskScore: null as number | null,
    at: i,
  }))
  s = terminalReducer(s, { type: 'LOAD_HISTORY', entries: many })
  assert(s.history.length === 20, 'LOAD_HISTORY cap 20')

  // RATE_LIMITED / CLEAR_RATE_LIMIT
  s = terminalReducer(initialTerminalState, { type: 'RATE_LIMITED', retryAfter: 5 })
  assert(s.rateLimited?.retryAfter === 5 && typeof s.rateLimited.until === 'number', 'RATE_LIMITED')
  s = terminalReducer(s, { type: 'CLEAR_RATE_LIMIT' })
  assert(s.rateLimited === null, 'CLEAR_RATE_LIMIT')

  // Malformed HYDRATE_COMPLETE — history not array
  s = terminalReducer(initialTerminalState, {
    type: 'HYDRATE_COMPLETE',
    key: sampleKey,
    history: null as unknown as HistoryEntry[],
    cryptoWarning: null,
  })
  assert(s.history.length === 0, 'HYDRATE_COMPLETE bad history → []')

  // Malformed HYDRATE_COMPLETE — key invalid shape
  s = terminalReducer(initialTerminalState, {
    type: 'HYDRATE_COMPLETE',
    key: { raw: 'x' } as unknown as VerifiedKey,
    history: [],
    cryptoWarning: null,
  })
  assert(s.key === null && s.phase === 'idle', 'HYDRATE_COMPLETE invalid key rejected')

  assert(failed === 0, `failed count ${failed}`)
  if (failed > 0) {
    process.exit(1)
  }
  console.log('OK — terminal reducer: 16 action types + 3 edge cases.')
}

main()
