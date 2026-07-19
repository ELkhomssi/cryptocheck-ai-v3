import 'server-only'

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { assessRecipient } from '@/lib/payments/recipient-risk'

/**
 * Creator reputation gate — uses existing gateway + recipient risk ledger.
 * We cannot scan a wallet as a mint perfectly; we combine:
 * 1) hard blacklist / reputation ledger (assessRecipient)
 * 2) best-effort gateway assessRiskByMint on the address (same path reputation uses)
 */
export async function assessCreatorReputation(creatorWallet: string): Promise<string[]> {
  const reasons: string[] = []
  const wallet = creatorWallet.trim()

  const recipient = await assessRecipient(wallet, 'solana')
  if (recipient.riskLevel === 'blacklisted') {
    reasons.push('Creator wallet is on the known-bad deployer blacklist')
  } else if (recipient.riskLevel === 'flagged' && !recipient.approved) {
    reasons.push('Creator wallet has a high-risk reputation score')
  }

  try {
    const assessment = await assessRiskByMint(wallet, 'solana', 'fast')
    if (assessment.verdict === 'BLOCKED' || assessment.riskScore >= 80) {
      reasons.push(
        `Creator linked to BLOCKED risk profile (score ${assessment.riskScore}/100) via Neural V4 gateway`,
      )
    } else if (assessment.verdict === 'HIGH_RISK' || assessment.riskScore >= 70) {
      reasons.push(
        `Creator flagged HIGH_RISK by Neural V4 gateway (score ${assessment.riskScore}/100)`,
      )
    }
  } catch {
    // Gateway may fail on non-mint addresses — recipient check above still applies.
  }

  return reasons
}
