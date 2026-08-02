/**
 * Guard: production trade-like-me route must never silently invent sample DNA.
 * Run: node --import tsx --test __tests__/terminal-os/trade-like-me-no-sample.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE = resolve(
  process.cwd(),
  'app/api/terminal-os/trade-like-me/route.ts',
)

describe('trade-like-me no silent sample', () => {
  const src = readFileSync(ROUTE, 'utf8')

  it('gates buildSampleTradeHistory behind explicit sample=1', () => {
    assert.ok(
      src.includes("sample') === '1'") || src.includes('sample") === "1"'),
      'route must check sample=1 query param',
    )
    assert.ok(
      src.includes('buildSampleTradeHistory'),
      'sample helper may be imported for explicit sample=1 only',
    )
    // Unconditional seed (old silent path) must not exist
    assert.ok(
      !/const trades:\s*CapturedTrade\[\]\s*=\s*buildSampleTradeHistory/.test(src),
      'must not unconditionally assign trades from buildSampleTradeHistory',
    )
    assert.ok(
      /if\s*\(\s*wantSample\s*\)[\s\S]*?buildSampleTradeHistory/.test(src),
      'buildSampleTradeHistory must only run inside wantSample branch',
    )
  })

  it('never hardcodes sampleDna: true outside wantSample', () => {
    assert.ok(
      !/sampleDna:\s*true/.test(src),
      'sampleDna must not be hardcoded true',
    )
    assert.ok(
      /sampleDna:\s*wantSample/.test(src),
      'sampleDna must equal wantSample (true only when sample=1)',
    )
  })

  it('returns insufficientData / empty dna when no real data (no invented ready DNA)', () => {
    assert.ok(src.includes('insufficientData'))
    assert.ok(src.includes("phase: 'insufficient'") || src.includes('phase: "insufficient"'))
    assert.ok(src.includes('getPersistedDna'))
    assert.ok(src.includes('fetchCapturedTrades'))
  })

  it('train/client path: useTradeLikeMeEngine uses trade-history not sample', () => {
    const hook = readFileSync(
      resolve(process.cwd(), 'features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine.ts'),
      'utf8',
    )
    assert.ok(hook.includes('/api/terminal-os/trade-history'))
    assert.ok(!hook.includes('buildSampleTradeHistory'))
    assert.ok(!hook.includes('sample-trade-history'))
  })
})
