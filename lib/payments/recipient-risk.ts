import 'server-only'

import { readReputation } from '@/lib/b2b/reputation-ledger'

export type RecipientRiskLevel = 'clean' | 'unknown' | 'flagged' | 'blacklisted'

export interface RecipientAssessment {
  verified: boolean
  riskLevel: RecipientRiskLevel
  transactionCount?: number
  firstSeenAt?: string
  knownEntity?: string
  approved: boolean
}

/**
 * Hard blacklist — illustrative seed list. Populate from threat-intel feeds in production.
 * Blacklisted recipients are a hard block with no user override.
 */
const BLACKLIST = new Set<string>([
  // (Seed entries — replace/extend from ops threat-intel.)
  'BadActor1111111111111111111111111111111111',
  'Drainer22222222222222222222222222222222222',
  'Scammer3333333333333333333333333333333333',
])

/** Known-entity allowlist — major venues considered safe recipients. Extend in ops. */
const KNOWN_ENTITIES: Record<string, string> = {
  // 'wallet': 'Entity name'  — populate with verified exchange/custodian deposit wallets.
}

/**
 * Assesses a payment recipient. Order: blacklist → known entity → reputation ledger → unknown.
 */
export async function assessRecipient(
  walletAddress: string,
  chain: string
): Promise<RecipientAssessment> {
  const addr = walletAddress.trim()

  if (BLACKLIST.has(addr)) {
    return { verified: false, riskLevel: 'blacklisted', approved: false }
  }

  const knownEntity = KNOWN_ENTITIES[addr]
  if (knownEntity) {
    return { verified: true, riskLevel: 'clean', knownEntity, approved: true }
  }

  // Reputation ledger (fast, cached). High risk → flagged (override allowed, not auto-approved).
  try {
    const rep = await readReputation(chain, addr)
    if (rep) {
      if (rep.riskScore >= 70) {
        return { verified: false, riskLevel: 'flagged', approved: false }
      }
      if (rep.riskScore < 40) {
        return { verified: true, riskLevel: 'clean', approved: true }
      }
      return { verified: false, riskLevel: 'unknown', approved: true }
    }
  } catch {
    /* ledger optional */
  }

  // No history → unknown but allowed (surfaced as a soft flag to the payer).
  return { verified: false, riskLevel: 'unknown', approved: true }
}
