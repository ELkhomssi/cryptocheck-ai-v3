import 'server-only'

/** Shown on the public status page and in `/api/status/public` — marketing / commitment copy (not a contract substitute). */
export const PUBLIC_STATUS_SLA = {
  /** Target availability we communicate for the core Security Intelligence API surface. */
  targetMonthlyAvailabilityPct: 99.9,
  scope:
    'POST /api/v1/scan, batch scan, and authenticated dashboard intelligence APIs hosted on CryptoCheck infrastructure.',
  exclusions:
    'Scheduled maintenance (announced when possible), third-party Solana RPC and indexer outages, DexScreener and other external data providers, and issues caused by client networks or invalid requests.',
  measurement:
    'Availability is measured as successful synthetic health validation of our application and primary database path. Rolling probe statistics require Upstash Redis (optional).',
} as const

export type PublicStatusIncident = {
  title: string
  description?: string
  severity: 'maintenance' | 'minor' | 'major'
  since?: string
}

/**
 * Optional urgent banner — set `STATUS_ACTIVE_INCIDENTS_JSON` to a JSON array, e.g.
 * `[{"title":"Elevated scan latency","severity":"minor","since":"2026-04-22T12:00:00Z"}]`
 */
export function readActiveIncidentsFromEnv(): PublicStatusIncident[] {
  const raw = process.env.STATUS_ACTIVE_INCIDENTS_JSON?.trim()
  if (!raw) return []
  try {
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    return j
      .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object' && typeof (x as { title?: unknown }).title === 'string')
      .map((o) => {
        const s = o.severity
        const severity: PublicStatusIncident['severity'] =
          s === 'maintenance' || s === 'major' || s === 'minor' ? s : 'minor'
        return {
          title: String(o.title),
          description: typeof o.description === 'string' ? o.description : undefined,
          severity,
          since: typeof o.since === 'string' ? o.since : undefined,
        }
      })
  } catch {
    return []
  }
}
