/**
 * Foundation fix #1 — FIFO fills → CapturedTrade (no signature stubs).
 * Run: node --import tsx --test __tests__/terminal-os/capture-wallet-trades.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fillsToCapturedTrades } from '../../lib/terminal-os/fills-to-captured-trades'
import type { FifoFill } from '../../lib/terminal/portfolio-math'

const root = process.cwd()

describe('capture-wallet-trades', () => {
  it('builds closed round-trips with hold time and PnL from priced fills', () => {
    const mint = 'TokenMint111111111111111111111111111111111'
    const fills: FifoFill[] = [
      { mint, side: 'buy', qty: 10, priceUsd: 1, ts: 1_000_000 },
      { mint, side: 'sell', qty: 10, priceUsd: 1.2, ts: 1_000_000 + 3_600_000 },
    ]
    const { trades, closedRounds, openBuysRecorded } = fillsToCapturedTrades('WalletABC', fills)
    assert.equal(closedRounds, 1)
    assert.equal(openBuysRecorded, 0)
    assert.equal(trades.length, 1)
    const t = trades[0]!
    assert.equal(t.sample, false)
    assert.ok(t.pnlPct != null && Math.abs(t.pnlPct - 20) < 0.01)
    assert.equal(t.holdingDurationMs, 3_600_000)
    assert.equal(t.positionSizeUsd, 10)
    assert.ok(t.exitAt)
    assert.match(t.entryWhy ?? '', /Helius/)
  })

  it('records open buys without inventing exit', () => {
    const mint = 'TokenMint222222222222222222222222222222222'
    const fills: FifoFill[] = [{ mint, side: 'buy', qty: 5, priceUsd: 2, ts: 2_000_000 }]
    const { trades, closedRounds, openBuysRecorded } = fillsToCapturedTrades('WalletABC', fills)
    assert.equal(closedRounds, 0)
    assert.equal(openBuysRecorded, 1)
    assert.equal(trades[0]!.side, 'buy')
    assert.equal(trades[0]!.exitAt, null)
    assert.equal(trades[0]!.pnlPct, undefined)
  })

  it('trade-history route no longer stubs UNK/$0 signatures', () => {
    const route = readFileSync(join(root, 'app/api/terminal-os/trade-history/route.ts'), 'utf8')
    assert.match(route, /captureWalletTradesForDna/)
    assert.doesNotMatch(route, /tokenSymbol: 'UNK'/)
    assert.doesNotMatch(route, /entryPriceUsd: 0/)
    assert.doesNotMatch(route, /rpc_signatures/)
  })

  it('decision-engine cron is registered every 2 minutes', () => {
    const cfg = readFileSync(join(root, 'vercel.json'), 'utf8')
    assert.match(cfg, /\/api\/cron\/decision-engine/)
    assert.match(cfg, /\*\/2 \* \* \* \*/)
  })
})
