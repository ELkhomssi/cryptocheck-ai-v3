export type HealthStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'NOT_DEPLOYED' | 'UNAVAILABLE'

export type DiagnosticWarning = {
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  message: string
  at: string
}

export type SystemHealthPayload = {
  timestamp: string
  overall_readiness: number | null
  categories: Record<string, unknown>
  readiness_by_feature: Record<string, { score: number | null; level: string }>
  alerts: DiagnosticWarning[]
  collection_errors: Array<{ source: string; message: string; at: string }>
}
