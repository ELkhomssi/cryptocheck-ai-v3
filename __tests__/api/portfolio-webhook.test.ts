import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * Mirrors normalizeEvent in app/api/webhooks/helius-portfolio/route.ts
 * so we can unit-test classification without Next.js request plumbing.
 */
function classifyType(typeRaw: string): string {
  const t = typeRaw.toLowerCase()
  if (t.includes('liq')) return 'liquidity'
  if (t.includes('dev')) return 'dev_wallet'
  if (t.includes('risk') || t.includes('rug')) return 'risk'
  if (t.includes('smart')) return 'smart_money'
  return 'whale'
}

describe('portfolio helius webhook classification', () => {
  it('maps event type keywords to alert types', () => {
    assert.equal(classifyType('LIQUIDITY_POOL'), 'liquidity')
    assert.equal(classifyType('dev_wallet_transfer'), 'dev_wallet')
    assert.equal(classifyType('rug_risk'), 'risk')
    assert.equal(classifyType('smart_money'), 'smart_money')
    assert.equal(classifyType('TRANSFER'), 'whale')
  })
})
