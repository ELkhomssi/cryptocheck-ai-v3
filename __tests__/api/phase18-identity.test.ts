/**
 * Phase 18.3 — tenant isolation for intelligence-core surfaces.
 * Asserts user A scoped queries never leak user B rows (mission / timeline /
 * recommendations / memory).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertNoCrossTenantLeak,
  filterTenantRows,
} from '../../lib/identity/tenant-scope'
import { buildMissionOsSummary } from '../../lib/portfolio-desk/mission-narrative'
import type { MissionViewModel } from '../../types/intelligence-core'
import {
  decodeSiwsSession,
  encodeSiwsSession,
  mintSiwsSession,
} from '../../lib/identity/session-token'
import { FEATURE_UNLOCK_COPY } from '../../lib/identity/entitlements-copy'
import { buildSiwsMessage, verifySiwsSignature } from '../../lib/identity/siws-message'
import nacl from 'tweetnacl'
import { Keypair } from '@solana/web3.js'

// session.ts is server-only — for unit test we exercise encode/decode via env secret
process.env.SIWS_SESSION_SECRET = process.env.SIWS_SESSION_SECRET || 'phase18-test-secret'

describe('Phase 18.3 — tenant isolation', () => {
  const userA = { userId: '11111111-1111-1111-1111-111111111111', wallets: ['WalletAAAA'] }
  const userB = { userId: '22222222-2222-2222-2222-222222222222', wallets: ['WalletBBBB'] }

  it('memory rows for A exclude B', () => {
    const rows = [
      { userId: userA.userId, action: 'token_scanned', subjectId: 'mintA' },
      { userId: userB.userId, action: 'token_scanned', subjectId: 'mintB' },
      { userId: userA.userId, action: 'wallet_tracked', subjectId: 'wA' },
    ]
    const scoped = filterTenantRows(rows, userA)
    assert.equal(scoped.length, 2)
    assert.ok(scoped.every((r) => r.userId === userA.userId))
    assertNoCrossTenantLeak(scoped, userA, userB.userId)
  })

  it('timeline owner_key scope never returns the other tenant', () => {
    const events = [
      { ownerKey: userA.wallets[0], summary: 'A order filled' },
      { ownerKey: userB.wallets[0], summary: 'B alert' },
      { ownerKey: userA.userId, summary: 'A memory-adjacent' },
    ]
    const scoped = filterTenantRows(events, userA)
    assert.equal(scoped.length, 2)
    assert.ok(!scoped.some((e) => e.summary.startsWith('B')))
    assertNoCrossTenantLeak(scoped, userA, userB.userId)
  })

  it('recommendations tagged for B never appear in A scope', () => {
    const recs = [
      {
        userId: userA.userId,
        title: 'A risk drop',
        explanation: 'liquidity up',
        grounded: true,
      },
      {
        userId: userB.userId,
        title: 'B secret alpha',
        explanation: 'should not leak',
        grounded: true,
      },
    ]
    const scoped = filterTenantRows(recs, userA)
    assert.equal(scoped.length, 1)
    assert.equal(scoped[0]!.title, 'A risk drop')
    assertNoCrossTenantLeak(scoped, userA, userB.userId)
  })

  it('mission OS summary for A with A-only recs never includes B titles', () => {
    const view: MissionViewModel = {
      market: {
        available: true,
        aggregateChange24hPct: 3,
        topMoverSymbol: 'WIF',
        topMoverChange24hPct: 10,
        spark: [1, 2],
      },
      portfolio: {
        connected: true,
        totalValueUsd: 1000,
        dayChangePct: 1,
        topWeightSymbol: 'BONK',
        error: null,
      },
      running: [],
      recommendations: [
        {
          title: 'A only priority',
          explanation: 'holder concentration dropped',
          grounded: true,
          predictionId: 'p1',
        },
      ],
      dailyBrief: {
        title: 'Morning Brief',
        body: 'ok',
        insufficientActivity: false,
        pending: false,
        reportId: null,
      },
      firstRun: false,
      userId: userA.userId,
      fetchedAt: new Date().toISOString(),
    }
    const os = buildMissionOsSummary(view)
    const blob = JSON.stringify(os)
    assert.doesNotMatch(blob, /B secret|WalletBBBB|22222222/)
    assert.match(blob, /A only priority/)
  })

  it('SIWS session for A cannot decode as B', () => {
    const sessA = mintSiwsSession(userA.userId, userA.wallets[0]!)
    const token = encodeSiwsSession(sessA)
    const decoded = decodeSiwsSession(token)
    assert.equal(decoded?.userId, userA.userId)
    assert.notEqual(decoded?.userId, userB.userId)
  })
})

describe('Phase 18.1 — SIWS crypto', () => {
  it('verifies a real ed25519 wallet signature over the challenge message', () => {
    const kp = Keypair.generate()
    const wallet = kp.publicKey.toBase58()
    const message = buildSiwsMessage({
      domain: 'localhost',
      wallet,
      nonce: 'test-nonce',
      issuedAt: '2026-07-27T00:00:00.000Z',
      expiresAt: '2026-07-27T00:10:00.000Z',
    })
    const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey)
    const signatureBase64 = Buffer.from(sig).toString('base64')
    assert.equal(verifySiwsSignature({ wallet, message, signatureBase64 }), true)
    assert.equal(
      verifySiwsSignature({ wallet, message: message + 'x', signatureBase64 }),
      false,
    )
  })
})

describe('Phase 18.5 — entitlement copy is specific', () => {
  it('names the gated capability (not a generic upgrade line)', () => {
    assert.match(FEATURE_UNLOCK_COPY.automation, /Automation/i)
    assert.match(FEATURE_UNLOCK_COPY.scheduled_reports, /Daily|Weekly|Monthly/i)
    assert.match(FEATURE_UNLOCK_COPY.launchlab_create, /LaunchLab/i)
    assert.doesNotMatch(FEATURE_UNLOCK_COPY.automation, /^upgrade to continue$/i)
  })
})
