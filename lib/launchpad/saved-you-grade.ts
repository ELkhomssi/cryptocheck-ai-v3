import 'server-only'

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import {
  insertSavedYou,
  listPendingBlocks,
  markBlockOutcome,
} from '@/lib/launchpad/saved-you'

const MS_72H = 72 * 60 * 60 * 1000

/**
 * Compound rug signal — NEVER price/drawdown alone (volatile ≠ rug).
 * Requires high risk PLUS at least one concrete evidence flag from Neural V4.
 */
const RUG_EVIDENCE_RE =
  /lp[_\s-]?unlock|lp[_\s-]?pull|liquidity\s*remov|honeypot|mint[_\s-]?author|freeze[_\s-]?author|rug|halt|trading\s*halt|blacklist|renounc/i

function hasCompoundRugEvidence(
  verdict: string,
  risk: number,
  evidenceLabels: string[],
  evidenceLine: string,
): { rugged: boolean; reasons: string[] } {
  const reasons: string[] = []
  const hardBlock = verdict === 'BLOCKED' || risk >= 85
  if (!hardBlock) return { rugged: false, reasons }

  reasons.push(`gateway ${verdict} risk=${risk}`)
  const blob = [...evidenceLabels, evidenceLine].join(' · ')
  const evidenceHit = RUG_EVIDENCE_RE.test(blob) || evidenceLabels.some((l) => RUG_EVIDENCE_RE.test(l))

  // BLOCKED at max severity may indicate structural failure even without keywords.
  if (verdict === 'BLOCKED' && risk >= 90) {
    reasons.push('BLOCKED with risk≥90 (structural kill-switch)')
    return { rugged: true, reasons }
  }

  if (evidenceHit) {
    reasons.push('compound evidence: LP/mint/halt/honeypot pattern in scan factors')
    return { rugged: true, reasons }
  }

  // High risk alone after a block is inconclusive — do NOT claim a save (volatility trap).
  return { rugged: false, reasons: [...reasons, 'high risk without LP/mint/halt evidence — not marked rugged'] }
}

/**
 * Grade pending user_blocks from real gateway re-assess + compound rug rules.
 * NEVER fabricates a save — only outcome=rugged creates saved_you.
 */
export async function runSavedYouGrading(): Promise<{ graded: number; saved: number }> {
  const pending = await listPendingBlocks(40)
  let graded = 0
  let saved = 0

  for (const block of pending) {
    try {
      const age = Date.now() - Date.parse(block.blocked_at)
      const assessment = await assessRiskByMint(block.mint, 'solana', 'fast')
      const risk = assessment.riskScore
      const labels = assessment.snapshot.reasoning.evidence.slice(0, 8).map((e) => e.label)
      const summary = assessment.snapshot.reasoning.clusterAnalysis.summary ?? ''
      const { rugged, reasons } = hasCompoundRugEvidence(
        assessment.verdict,
        risk,
        labels,
        summary,
      )

      if (rugged) {
        const drawdown = Math.min(0.99, risk / 100)
        const intended = block.intended_amount_usd != null ? Number(block.intended_amount_usd) : null
        const lossEst =
          intended != null && Number.isFinite(intended)
            ? Math.round(intended * Math.max(drawdown, 0.9) * 100) / 100
            : null

        await markBlockOutcome(block.id, 'rugged')
        const row = await insertSavedYou({
          blockId: block.id,
          userId: block.user_id,
          mint: block.mint,
          symbol: block.symbol,
          blockedAt: block.blocked_at,
          priceAtBlock: null,
          priceAtGrade: null,
          drawdownPct: Math.round(drawdown * 1000) / 10,
          lossAvoidedEstimate: lossEst,
          outcomeEvidence: `Neural V4 compound rug: ${reasons.join('; ')} · factors=${labels.slice(0, 4).join(', ') || 'n/a'}`,
          explorerUrl: `https://solscan.io/token/${block.mint}`,
        })
        graded += 1
        if (row) saved += 1
        continue
      }

      if (age >= MS_72H) {
        const survived = assessment.verdict === 'SAFE' || assessment.safetyScore >= 50
        await markBlockOutcome(block.id, survived ? 'survived' : 'expired')
        graded += 1
      }
      // else leave pending (inconclusive / high-vol alone)
    } catch (e) {
      console.error('[saved-you] grade failed', block.id, e instanceof Error ? e.message : e)
    }
  }

  return { graded, saved }
}
