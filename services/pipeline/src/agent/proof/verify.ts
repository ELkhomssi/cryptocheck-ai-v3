import type { ProofRecord, VerifyResult } from '@cryptocheck/signal-contracts'
import { hashRawPacket } from '../data-hash.js'
import { verifyCommitment } from '../sign.js'
import {
  commitmentHashFromMemo,
  hashCommitment,
} from './commitment.js'
import { readMemosFromTx } from './memo.js'
import type { ProofIndex } from './index-store.js'

/**
 * verify(): re-hash stored raw packet + commitment and confirm against index / on-chain Memo.
 * Proves the agent saw exactly this data and made exactly this call.
 */
export async function verifyProof(
  index: ProofIndex,
  commitmentHash: string,
): Promise<VerifyResult> {
  const details: string[] = []
  const record = await index.get(commitmentHash)

  if (!record) {
    return {
      ok: false,
      commitmentHash,
      checks: {
        dataHashMatch: false,
        commitmentHashMatch: false,
        hmacValid: null,
        onChainMatch: null,
      },
      details: ['Proof record not found in off-chain index'],
    }
  }

  const recomputedHash = hashCommitment(record.commitment)
  const commitmentHashMatch = recomputedHash === record.commitmentHash
  details.push(
    commitmentHashMatch
      ? 'commitmentHash matches recomputed commitment'
      : `commitmentHash mismatch (stored=${record.commitmentHash.slice(0, 12)}… recomputed=${recomputedHash.slice(0, 12)}…)`,
  )

  let dataHashMatch = true
  if (record.commitment.kind === 'decision') {
    if (!record.rawPacket) {
      dataHashMatch = false
      details.push('rawPacket missing — cannot re-hash source data')
    } else {
      const recomputedData = hashRawPacket(record.rawPacket)
      dataHashMatch = recomputedData === record.commitment.dataHash
      details.push(
        dataHashMatch
          ? 'dataHash matches re-hashed raw TxODDS packet'
          : 'dataHash mismatch — packet may have been altered',
      )
    }
  } else {
    details.push('settlement proof — dataHash is settlement inputs (not source packet)')
  }

  let hmacValid: boolean | null = null
  if (record.hmacSignature && record.hmacSignedAt) {
    hmacValid = verifyCommitment(
      record.commitment as unknown as Record<string, unknown>,
      record.hmacSignature,
      record.hmacSignedAt,
    )
    details.push(hmacValid ? 'HMAC signature valid' : 'HMAC signature invalid')
  } else {
    details.push('HMAC not present (signing key unset at commit time)')
  }

  let onChainMatch: boolean | null = null
  if (!record.txSignature) {
    details.push('no txSignature — not committed')
  } else if (record.txSignature.startsWith('paper:')) {
    onChainMatch = true
    details.push('paper commitment (not broadcast) — index is source of truth')
  } else {
    try {
      const memos = await readMemosFromTx(record.txSignature)
      const hashes = memos.map(commitmentHashFromMemo).filter(Boolean)
      onChainMatch = hashes.includes(record.commitmentHash)
      details.push(
        onChainMatch
          ? `on-chain Memo matches commitmentHash (tx=${record.txSignature.slice(0, 12)}…)`
          : `on-chain Memo missing commitmentHash (memos=${memos.length})`,
      )
    } catch (e) {
      onChainMatch = false
      details.push(`on-chain read failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const ok =
    commitmentHashMatch &&
    dataHashMatch &&
    (hmacValid === null || hmacValid === true) &&
    (onChainMatch === null || onChainMatch === true)

  return {
    ok,
    commitmentHash: record.commitmentHash,
    checks: { dataHashMatch, commitmentHashMatch, hmacValid, onChainMatch },
    details,
  }
}

export async function verifyDecisionProof(
  index: ProofIndex,
  decisionId: string,
): Promise<VerifyResult> {
  const record = await index.getByDecisionId(decisionId)
  if (!record) {
    return {
      ok: false,
      commitmentHash: '',
      checks: {
        dataHashMatch: false,
        commitmentHashMatch: false,
        hmacValid: null,
        onChainMatch: null,
      },
      details: [`No proof for decision ${decisionId}`],
    }
  }
  return verifyProof(index, record.commitmentHash)
}
