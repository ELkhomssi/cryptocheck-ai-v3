export type SniperConfig = {
  port: number
  /** Scanner microservice base URL (POST {base}/scan). */
  scannerUrl: string
  /** Minimum neuralScore (safety 0..100) to emit a candidate. */
  minScore: number
  /** Which token event types count as snipe triggers. */
  triggerTypes: string[]
  /** Stream read batch size + block. */
  batch: number
  blockMs: number
  /** Per-scan timeout when calling the scanner. */
  scanTimeoutMs: number
  /** Persist every scan (noisy/costly) vs only candidate + blocked. */
  logAllScans: boolean
  /** Master enable — when false, the worker idles (still serves health). */
  enabled: boolean
}

function bool(v: string | undefined, dflt: boolean): boolean {
  const t = v?.trim().toLowerCase()
  if (t === undefined || t === '') return dflt
  return t === '1' || t === 'true' || t === 'yes'
}
function num(v: string | undefined, dflt: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : dflt
}

export function loadConfig(): SniperConfig {
  const triggerTypes = (process.env.SNIPER_TRIGGER_TYPES?.trim() || 'buy')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  return {
    port: Number(process.env.PORT ?? process.env.SNIPER_HEALTH_PORT ?? 4104),
    scannerUrl: (process.env.SCANNER_URL?.trim() || 'http://127.0.0.1:4103').replace(/\/$/, ''),
    minScore: num(process.env.SNIPER_MIN_SCORE, 70),
    triggerTypes,
    batch: num(process.env.SNIPER_BATCH, 10),
    blockMs: num(process.env.SNIPER_BLOCK_MS, 3_000),
    scanTimeoutMs: num(process.env.SNIPER_SCAN_TIMEOUT_MS, 4_000),
    logAllScans: bool(process.env.SNIPER_LOG_ALL_SCANS, false),
    enabled: bool(process.env.SNIPER_ENABLED, true),
  }
}
