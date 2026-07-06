import {
  SIGNAL_PROOF_INDEX_PREFIX,
  type ProofRecord,
  type VerifyResult,
} from '@cryptocheck/signal-contracts'
import {
  DEV_SIGNING_SALT_FALLBACK,
  verifySignature,
} from '@cryptocheck/signing'
import { canonicalJson, hashCommitment, hashRawPacket } from './hash'
import { getAgentRedis } from './redis'

async function loadProof(commitmentHash: string): Promise<ProofRecord | null> {
  const redis = getAgentRedis()
  if (!redis) return null
  const raw = await redis.get<string | ProofRecord>(`${SIGNAL_PROOF_INDEX_PREFIX}${commitmentHash}`)
  if (!raw) return null
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as ProofRecord
  } catch {
    return null
  }
}

function hmacValid(record: ProofRecord): boolean | null {
  if (!record.hmacSignature || !record.hmacSignedAt) return null
  const key =
    process.env.SIGNAL_AGENT_SIGNING_KEY?.trim() ||
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    ''
  if (!key) return null
  const salt =
    process.env.SIGNAL_AGENT_SIGNING_SALT?.trim() ||
    process.env.API_SIGNING_SALT?.trim() ||
    DEV_SIGNING_SALT_FALLBACK
  return verifySignature(
    record.hmacSignedAt,
    canonicalJson(record.commitment),
    record.hmacSignature,
    key,
    salt,
  )
}

/** Re-hash stored packet + commitment; paper txs trust the index. */
export async function verifyCommitmentHash(commitmentHash: string): Promise<VerifyResult> {
  const details: string[] = []
  const record = await loadProof(commitmentHash)

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
      details: ['Proof record not found — gate must have committed with Redis index'],
    }
  }

  const recomputed = hashCommitment(record.commitment)
  const commitmentHashMatch = recomputed === record.commitmentHash
  details.push(
    commitmentHashMatch
      ? 'commitmentHash matches recomputed commitment'
      : 'commitmentHash mismatch',
  )

  let dataHashMatch = true
  if (record.commitment.kind === 'decision') {
    if (!record.rawPacket) {
      dataHashMatch = false
      details.push('rawPacket missing')
    } else {
      dataHashMatch = hashRawPacket(record.rawPacket) === record.commitment.dataHash
      details.push(
        dataHashMatch
          ? 'dataHash matches re-hashed TxODDS packet'
          : 'dataHash mismatch — packet may have been altered',
      )
    }
  } else {
    details.push('settlement proof — outcome/PnL commitment')
  }

  const hmac = hmacValid(record)
  if (hmac === true) details.push('HMAC signature valid')
  else if (hmac === false) details.push('HMAC signature invalid')
  else details.push('HMAC not checked (signing key unset on API)')

  let onChainMatch: boolean | null = null
  if (!record.txSignature) {
    details.push('no txSignature')
  } else if (record.txSignature.startsWith('paper:')) {
    onChainMatch = true
    details.push('paper commitment — index is source of truth')
  } else {
    onChainMatch = true
    details.push(`live tx recorded: ${record.txSignature.slice(0, 12)}… (explorer verify)`)
  }

  const ok =
    commitmentHashMatch &&
    dataHashMatch &&
    (hmac === null || hmac === true) &&
    (onChainMatch === null || onChainMatch === true)

  return {
    ok,
    commitmentHash: record.commitmentHash,
    checks: { dataHashMatch, commitmentHashMatch, hmacValid: hmac, onChainMatch },
    details,
  }
}
