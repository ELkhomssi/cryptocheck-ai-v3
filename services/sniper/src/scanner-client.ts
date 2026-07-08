import type { ScanReport } from '@cryptocheck/signal-contracts'

/**
 * Calls the Scanner microservice. On any failure returns a fail-safe report
 * (safeToSnipe=false) so the kill-switch blocks by default — never buy blind.
 */
export async function scanMint(
  scannerUrl: string,
  mint: string,
  timeoutMs: number,
): Promise<ScanReport> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${scannerUrl}/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mint }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return failSafe(mint, `scanner ${res.status}`)
    }
    const report = (await res.json()) as ScanReport
    // Defensive: if the scanner ever omits the kill-switch, force it closed.
    if (typeof report.safeToSnipe !== 'boolean') report.safeToSnipe = false
    return report
  } catch (e) {
    return failSafe(mint, e instanceof Error ? e.message : 'scanner unreachable')
  } finally {
    clearTimeout(timer)
  }
}

function failSafe(mint: string, reason: string): ScanReport {
  return {
    mint,
    ok: false,
    neuralScore: 0,
    riskScore: 100,
    verdict: 'BLOCKED',
    redFlags: ['UNRESOLVED'],
    mintAuthorityActive: null,
    freezeAuthorityActive: null,
    honeypot: null,
    evidenceSummary: `Scan unavailable (${reason}); blocked by fail-safe kill-switch.`,
    safeToSnipe: false,
    source: 'degraded',
    scannedAt: new Date().toISOString(),
    latencyMs: 0,
  }
}
