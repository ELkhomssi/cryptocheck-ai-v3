import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isValidSolanaWallet } from '../../lib/portfolio-desk/validate'

describe('portfolio holdings wallet validation', () => {
  it('rejects missing and short wallets', () => {
    assert.equal(isValidSolanaWallet(null), false)
    assert.equal(isValidSolanaWallet(''), false)
    assert.equal(isValidSolanaWallet('abc'), false)
  })

  it('accepts base58-length wallet addresses', () => {
    assert.equal(
      isValidSolanaWallet('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
      true,
    )
  })
})
