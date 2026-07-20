import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { scanToVerdictCard } from '@/lib/trading-terminal/map-verdict'

function baseScan(over: Partial<ScanResult> = {}): ScanResult {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    safetyScore: 80,
    riskScore: 20,
    verdict: 'SAFE',
    confidence: 'high',
    topSignals: [
      { id: 'a', label: 'LP locked', weight: 10, detail: 'LP locked 100%' },
      { id: 'b', label: 'Mint authority', weight: -5, detail: 'Mint auth active' },
    ],
    evidenceLine: 'Gateway scan complete',
    scannedAt: '2026-07-20T00:00:00.000Z',
    cache: 'miss',
    sample: false,
    ...over,
  }
}

describe('scanToVerdictCard', () => {
  it('maps SAFE with evidence coverage band', () => {
    const card = scanToVerdictCard(baseScan())
    assert.ok(card)
    assert.equal(card.verdict, 'SAFE')
    assert.equal(card.evidence.coverage, 1)
    assert.equal(card.confidenceBand, 'high')
    assert.ok(card.why.length > 0)
    assert.equal(card.why[0]!.source, 'scan.evidenceLine')
  })

  it('maps DANGER + high riskScore to BLOCKED', () => {
    const card = scanToVerdictCard(baseScan({ verdict: 'DANGER', riskScore: 85 }))
    assert.equal(card!.verdict, 'BLOCKED')
  })

  it('maps DANGER + lower riskScore to HIGH_RISK', () => {
    const card = scanToVerdictCard(baseScan({ verdict: 'DANGER', riskScore: 70 }))
    assert.equal(card!.verdict, 'HIGH_RISK')
  })

  it('returns INSUFFICIENT_DATA when evidence thin', () => {
    const card = scanToVerdictCard(
      baseScan({
        topSignals: [],
        evidenceLine: '',
        safetyScore: undefined as unknown as number,
        riskScore: undefined as unknown as number,
      }),
    )
    assert.equal(card!.verdict, 'INSUFFICIENT_DATA')
    assert.equal(card!.confidenceBand, 'low')
  })

  it('returns null for null scan', () => {
    assert.equal(scanToVerdictCard(null), null)
  })

  it('never fabricates opportunities', () => {
    assert.deepEqual(scanToVerdictCard(baseScan())!.opportunities, [])
  })
})
