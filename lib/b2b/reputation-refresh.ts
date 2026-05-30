import 'server-only'

import type { NextRequest } from 'next/server'
import { scanViaGateway, normalizeScanBody } from '@/lib/connect/scan-gateway'
import type { ProFeatureContext } from '@/lib/auth/pro-feature-access'
import { riskScoreToVerdict, writeReputation } from '@/lib/b2b/reputation-ledger'

/** Fire-and-forget scan + ledger write to refresh stale reputation entries. */
export function scheduleReputationRefresh(
  req: NextRequest,
  ctx: ProFeatureContext,
  chain: string,
  address: string
): void {
  void (async () => {
    try {
      const normalized = normalizeScanBody({ tokenAddress: address, mint: address, chain, depth: 'fast' })
      const result = await scanViaGateway(req, ctx, normalized, {
        suppressAudit: true,
        skipSessionRateLimit: true,
      })
      if (!result.ok) return

      const { snapshot, meta } = result
      const riskScore = Math.max(0, Math.min(100, Math.round(100 - snapshot.weighted.score)))
      const confidencePct = Math.round((snapshot.weighted.confidence ?? 0) * 100)
      await writeReputation({
        chain: chain.toLowerCase() === 'sol' ? 'solana' : chain.toLowerCase(),
        address,
        riskScore,
        verdict: riskScoreToVerdict(riskScore),
        confidence: confidencePct,
        topSignals: snapshot.reasoning.evidence
          .filter((e) => e.riskContribution > 0)
          .slice(0, 5)
          .map((e) => e.label),
        updatedAt: new Date().toISOString(),
        source: 'live',
      })
      void meta
    } catch {
      /* background refresh — best effort */
    }
  })()
}
