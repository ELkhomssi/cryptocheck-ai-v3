import type { ScanRedFlag, ScanReport, ScanSource, ScanVerdict } from '@cryptocheck/signal-contracts'
import { assessViaGateway } from './assess-client.js'
import type { ScannerConfig } from './config.js'
import { checkMintAuthority } from './helius.js'

type CacheEntry = { report: ScanReport; expiresAt: number }
const cache = new Map<string, CacheEntry>()

function gatewayVerdict(v: string | undefined, riskScore: number): ScanVerdict {
  if (v === 'SAFE' || v === 'CAUTION' || v === 'HIGH_RISK' || v === 'BLOCKED') return v
  if (riskScore >= 80) return 'BLOCKED'
  if (riskScore >= 60) return 'HIGH_RISK'
  if (riskScore >= 31) return 'CAUTION'
  return 'SAFE'
}

/**
 * Deep audit for a single mint. Runs the authoritative gateway score and the
 * independent Helius mint-authority check in parallel, merges them, and derives
 * the kill-switch (`safeToSnipe`). Target: < scanTimeoutMs.
 */
export async function deepAudit(mint: string, cfg: ScannerConfig): Promise<ScanReport> {
  const started = Date.now()

  const cached = cache.get(mint)
  if (cached && cached.expiresAt > started) {
    return { ...cached.report, latencyMs: 0 }
  }

  const [assess, authority] = await Promise.all([
    assessViaGateway(cfg.assessUrl, cfg.workerSecret, mint, cfg.scanTimeoutMs),
    checkMintAuthority(cfg.heliusRpcUrl, mint, Math.min(cfg.scanTimeoutMs, 2_500)),
  ])

  const redFlags: ScanRedFlag[] = []

  // --- Independent Helius kill-switch (works even if gateway is down) ---
  if (authority.mintAuthorityActive === true) redFlags.push('MINT_AUTHORITY_ACTIVE')
  if (authority.freezeAuthorityActive === true) redFlags.push('FREEZE_AUTHORITY_ACTIVE')

  // --- Gateway authoritative score / verdict ---
  const resolved = assess.resolved === true && assess.dropped !== true
  const neuralScore = typeof assess.neuralScore === 'number' ? assess.neuralScore : 0
  const riskScore =
    typeof assess.riskScore === 'number' ? assess.riskScore : Math.max(0, Math.min(100, 100 - neuralScore))
  const verdict = gatewayVerdict(assess.gatewayVerdict, riskScore)

  if (!resolved) redFlags.push('UNRESOLVED')
  if (verdict === 'BLOCKED') redFlags.push('BLOCKED_VERDICT')
  else if (verdict === 'HIGH_RISK') redFlags.push('HIGH_RISK_VERDICT')

  // Honeypot signal from gateway evidence (fast mode may not run sell-sim).
  const evidence = (assess.evidenceSummary ?? '').toLowerCase()
  const honeypot = evidence.includes('honeypot') || evidence.includes('sell simulation failed') ? true : null
  if (honeypot === true) redFlags.push('HONEYPOT')

  // --- Source provenance (for auditability) ---
  let source: ScanSource
  if (!assess.transportError && authority.ok) source = 'gateway+helius'
  else if (!assess.transportError) source = 'gateway'
  else if (authority.ok && (authority.mintAuthorityActive !== null || authority.freezeAuthorityActive !== null))
    source = 'helius-only'
  else source = 'degraded'

  const dedupFlags = [...new Set(redFlags)]

  // Kill-switch: only safe when the token resolved AND zero red flags.
  const safeToSnipe = resolved && dedupFlags.length === 0 && source !== 'degraded'

  const evidenceSummary =
    assess.evidenceSummary?.trim() ||
    (assess.dropReason ? `Unresolved: ${assess.dropReason}` : `Verdict ${verdict} · safety ${neuralScore}/100`)

  const report: ScanReport = {
    mint,
    ok: source !== 'degraded',
    neuralScore,
    riskScore,
    verdict,
    redFlags: dedupFlags,
    mintAuthorityActive: authority.mintAuthorityActive,
    freezeAuthorityActive: authority.freezeAuthorityActive,
    honeypot,
    evidenceSummary,
    safeToSnipe,
    source,
    scannedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  }

  cache.set(mint, { report, expiresAt: Date.now() + cfg.cacheTtlMs })
  return report
}
