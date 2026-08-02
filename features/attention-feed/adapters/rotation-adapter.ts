/**
 * Map capital-rotation proposals → AttentionItems.
 * Advise-only — never implies auto-execution.
 */

import type { RotationProposal } from '@/features/terminal-os/capital-rotation/types'
import type { AttentionItem } from '../types'

function pnlLabel(p: RotationProposal): string {
  const pct = p.exit.pnlPctFromEntry
  const sign = pct >= 0 ? '+' : ''
  const basis =
    p.exit.pnlBasis === 'change_24h' ? 'vs 24h (entry unavailable)' : 'from entry'
  return `${sign}${pct}% ${basis}`
}

/**
 * Pending rotation proposal → Attention feed item (automation-engine).
 */
export function adaptRotationProposalToAttention(
  proposal: RotationProposal | null | undefined,
): AttentionItem[] {
  if (!proposal || proposal.status !== 'proposed') return []

  const conf = Math.round(
    proposal.entry.decision.marketConfidence ?? proposal.entry.decision.confidence,
  )
  return [
    {
      id: `rotation:proposal:${proposal.id}`,
      sourceEngine: 'automation-engine',
      urgency: 'now',
      headline: `Rotation proposed: EXIT $${proposal.exit.symbol} → BUY $${proposal.entry.symbol}`,
      reality: `$${proposal.exit.symbol} is ${pnlLabel(proposal)} with confirming MarketContext deterioration. Threshold −${proposal.thresholdPct}% (${proposal.thresholdSource}).`,
      analysis:
        'Advise-only — nothing sells until you approve and sign both legs in Intelligence Swap. Exit may still be a real loss versus entry.',
      recommendation: {
        action: `Review EXIT $${proposal.exit.symbol} then BUY $${proposal.entry.symbol}`,
        confidence: conf,
      },
      evidence: [
        {
          id: 'e-exit-pnl',
          kind: 'metric',
          label: 'Exit PnL',
          value: pnlLabel(proposal),
        },
        {
          id: 'e-threshold',
          kind: 'metric',
          label: 'Loss threshold',
          value: `−${proposal.thresholdPct}%`,
          detail: proposal.thresholdSource,
        },
        {
          id: 'e-security',
          kind: 'text',
          label: 'Entry security gate',
          value: proposal.entry.securityVerdict,
          detail: proposal.entry.securityPassed ? 'passed' : 'blocked',
        },
        {
          id: 'e-reasons',
          kind: 'text',
          label: 'Deterioration',
          detail: proposal.exit.deteriorationReasons.join(', '),
        },
      ],
      createdAt: proposal.createdAt,
      rankScore: 88 + (proposal.entry.securityPassed ? 4 : 0),
    } satisfies AttentionItem,
  ]
}
