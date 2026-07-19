import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PublicKey } from '@solana/web3.js'
import {
  DEV_LAUNCHPAD_PROGRAM,
  LAUNCHPAD_PROGRAM,
  getPdaLaunchpadPoolId,
} from '@raydium-io/raydium-sdk-v2'
import { NATIVE_MINT } from '@solana/spl-token'
import {
  isBondingCurveActive,
  LAUNCHPAD_POOL_STATUS,
  resolveLaunchpadPoolId,
} from '../../lib/launchlab/pool'

describe('resolveLaunchpadPoolId (deterministic PDA)', () => {
  it('matches SDK getPdaLaunchpadPoolId for mainnet + devnet', () => {
    const mint = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    const ours = resolveLaunchpadPoolId(mint, 'devnet')
    const theirs = getPdaLaunchpadPoolId(DEV_LAUNCHPAD_PROGRAM, mint, NATIVE_MINT).publicKey
    assert.equal(ours.toBase58(), theirs.toBase58())

    const oursM = resolveLaunchpadPoolId(mint, 'mainnet')
    const theirsM = getPdaLaunchpadPoolId(LAUNCHPAD_PROGRAM, mint, NATIVE_MINT).publicKey
    assert.equal(oursM.toBase58(), theirsM.toBase58())
    assert.notEqual(ours.toBase58(), oursM.toBase58())
  })
})

describe('bonding-curve status gate', () => {
  it('only FUND (0) is tradeable on-curve', () => {
    assert.equal(isBondingCurveActive(LAUNCHPAD_POOL_STATUS.FUND), true)
    assert.equal(isBondingCurveActive(LAUNCHPAD_POOL_STATUS.MIGRATE), false)
    assert.equal(isBondingCurveActive(LAUNCHPAD_POOL_STATUS.TRADE), false)
  })
})
