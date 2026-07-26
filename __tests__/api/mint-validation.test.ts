import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isValidSolanaAddress, isValidSolanaMint } from '../../lib/validation/mint'

describe('mint validation', () => {
  it('accepts well-known Solana mints as addresses', () => {
    assert.equal(
      isValidSolanaAddress('So11111111111111111111111111111111111111112'),
      true,
    )
    assert.equal(
      isValidSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
      true,
    )
  })

  it('rejects garbage', () => {
    assert.equal(isValidSolanaAddress(''), false)
    assert.equal(isValidSolanaAddress('not-a-mint'), false)
    assert.equal(isValidSolanaMint(''), false)
  })
})
