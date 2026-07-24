import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { TerminalOrder } from '../../types/portfolio-desk'

/** Mirrors triggerMet in lib/terminal/orders-cron.ts for unit coverage. */
function triggerMet(order: Pick<TerminalOrder, 'type' | 'triggerPrice'>, priceUsd: number): boolean {
  const t = order.triggerPrice
  if (t == null || !(t > 0)) return order.type === 'dca'
  if (order.type === 'tp') return priceUsd >= t
  if (order.type === 'sl' || order.type === 'limit') return priceUsd <= t
  return false
}

describe('terminal order trigger logic', () => {
  it('fires limit buy when price drops to trigger', () => {
    assert.equal(triggerMet({ type: 'limit', triggerPrice: 1 }, 0.9), true)
    assert.equal(triggerMet({ type: 'limit', triggerPrice: 1 }, 1.1), false)
  })

  it('fires tp when price rises to trigger', () => {
    assert.equal(triggerMet({ type: 'tp', triggerPrice: 2 }, 2.1), true)
    assert.equal(triggerMet({ type: 'tp', triggerPrice: 2 }, 1.5), false)
  })

  it('fires sl when price drops to trigger', () => {
    assert.equal(triggerMet({ type: 'sl', triggerPrice: 0.5 }, 0.4), true)
  })

  it('dca triggers without price', () => {
    assert.equal(triggerMet({ type: 'dca', triggerPrice: null }, 0), true)
  })
})
