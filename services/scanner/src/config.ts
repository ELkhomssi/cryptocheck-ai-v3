export type ScannerConfig = {
  port: number
  /** Frozen-core gateway assess endpoint (authoritative score). */
  assessUrl: string
  /** Bearer secret for the internal assess endpoint. */
  workerSecret: string
  /** Helius API key for the independent mint/freeze authority kill-switch. */
  heliusApiKey: string
  /** Full Helius RPC URL (derived from key when not set). */
  heliusRpcUrl: string
  /** Per-scan wall-clock budget (ms). */
  scanTimeoutMs: number
  /** Short in-memory cache TTL to absorb bursts on the same mint (ms). */
  cacheTtlMs: number
}

function firstEnv(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n]?.trim()
    if (v) return v
  }
  return ''
}

export function loadConfig(): ScannerConfig {
  const heliusApiKey = firstEnv('HELIUS_API_KEY', 'HELIUS_KEY')
  const heliusRpcUrl =
    firstEnv('SCANNER_HELIUS_RPC_URL', 'HELIUS_RPC_URL') ||
    (heliusApiKey ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}` : '')

  return {
    port: Number(process.env.PORT ?? process.env.SCANNER_PORT ?? 4103),
    assessUrl:
      firstEnv('SIGNAL_ASSESS_URL') ||
      `${firstEnv('NEXT_PUBLIC_APP_URL') || 'https://www.cryptocheckai.com'}/api/internal/signals/assess`,
    workerSecret: firstEnv('SIGNAL_WORKER_SECRET', 'CRON_SECRET'),
    heliusApiKey,
    heliusRpcUrl,
    scanTimeoutMs: Number(process.env.SCANNER_TIMEOUT_MS ?? 3_000),
    cacheTtlMs: Number(process.env.SCANNER_CACHE_TTL_MS ?? 10_000),
  }
}

/** Loose Solana mint validation (base58, 32–44 chars). */
export function isValidSolanaMint(mint: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint.trim())
}
