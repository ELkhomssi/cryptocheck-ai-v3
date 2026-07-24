import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  alertDedupeId,
  classifyAlertType,
  normalizeWebhookEvent,
} from '../../lib/portfolio-desk/alert-classify'

describe('portfolio helius webhook classification', () => {
  it('maps explicit and keyword event types', () => {
    assert.equal(classifyAlertType('whale_buy'), 'whale_buy')
    assert.equal(classifyAlertType('WHALE_SELL'), 'whale_sell')
    assert.equal(classifyAlertType('liquidity_added'), 'liquidity_added')
    assert.equal(classifyAlertType('liquidity_removed'), 'liquidity_removed')
    assert.equal(classifyAlertType('mint_authority'), 'mint_authority')
    assert.equal(classifyAlertType('freeze_authority'), 'freeze_authority')
    assert.equal(classifyAlertType('rug_risk'), 'rug_risk')
    assert.equal(classifyAlertType('smart_money_entry'), 'smart_money_entry')
    assert.equal(classifyAlertType('smart_money_exit'), 'smart_money_exit')
    assert.equal(classifyAlertType('new_listing'), 'new_listing')
    assert.equal(classifyAlertType('large_holder_distribution'), 'large_holder_distribution')
    assert.equal(classifyAlertType('new_token_launch'), 'new_token_launch')
    assert.equal(classifyAlertType('LIQUIDITY_POOL'), 'liquidity')
    assert.equal(classifyAlertType('dev_wallet_transfer'), 'dev_wallet')
    assert.equal(classifyAlertType('TRANSFER'), 'whale')
  })

  it('builds dedupe id from signature + type + mint', () => {
    assert.equal(
      alertDedupeId({
        signature: 'sigABC',
        type: 'whale_buy',
        mint: 'Mint111',
      }),
      'sigABC:whale_buy:Mint111',
    )
    assert.equal(
      alertDedupeId({ signature: 'sigABC', type: 'whale_buy' }),
      'sigABC:whale_buy',
    )
  })

  it('normalizes webhook events with dedupe id', () => {
    const alert = normalizeWebhookEvent({
      type: 'whale_buy',
      signature: 'abcSig',
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      description: 'large buy',
    })
    assert.ok(alert)
    assert.equal(alert!.type, 'whale_buy')
    assert.equal(alert!.id, 'abcSig:whale_buy:So11111111111111111111111111111111111111112')
    assert.equal(alert!.tokenSymbol, 'SOL')
  })
})
