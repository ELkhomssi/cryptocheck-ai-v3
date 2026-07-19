import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectDegrade, uniqueMintCount, normalizeCoachVerdict } from '@/lib/personal-watch/degrade'

describe('personal-watch degrade + cost model', () => {
  it('10 users × same mint → uniqueMintCount === 1', () => {
    const map = new Map<string, Set<string>>()
    const mint = 'So11111111111111111111111111111111111111112'
    const users = Array.from({ length: 10 }, (_, i) => `user-${i}`)
    map.set(mint, new Set(users))
    assert.equal(uniqueMintCount(map), 1)
    assert.equal(map.get(mint)!.size, 10)
  })

  it('SAFE→CAUTION and CAUTION→DANGER degrade', () => {
    assert.equal(detectDegrade({
      prevVerdict: 'SAFE',
      newVerdict: 'CAUTION',
      prevLabels: [],
      newLabels: [],
    }).degraded, true)

    assert.equal(detectDegrade({
      prevVerdict: 'CAUTION',
      newVerdict: 'DANGER',
      prevLabels: [],
      newLabels: [],
    }).degraded, true)

    assert.equal(detectDegrade({
      prevVerdict: 'DANGER',
      newVerdict: 'SAFE',
      prevLabels: [],
      newLabels: [],
    }).degraded, false)
  })

  it('new mint-authority factor triggers degrade without verdict step', () => {
    const r = detectDegrade({
      prevVerdict: 'SAFE',
      newVerdict: 'SAFE',
      prevLabels: ['Liquidity OK'],
      newLabels: ['Mint authority re-activated'],
    })
    assert.equal(r.degraded, true)
    assert.match(r.reason, /Mint authority/i)
  })

  it('normalizeCoachVerdict maps HIGH_RISK → DANGER', () => {
    assert.equal(normalizeCoachVerdict('HIGH_RISK'), 'DANGER')
    assert.equal(normalizeCoachVerdict('SAFE'), 'SAFE')
  })
})
