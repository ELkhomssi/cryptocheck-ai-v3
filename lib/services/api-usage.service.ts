import { logSecurityEvent } from '@/lib/services/security-log.service'

export type ApiUsageInput = {
  /** null when synthetic QA user would violate `security_logs` FK */
  userId: string | null
  apiKeyId?: string | null
  endpoint: string
  method: string
  statusCode: number
  durationMs: number
  ip?: string | null
  userAgent?: string | null
  priority?: boolean
  /** Optional org / desk label for batch scans (audit trail). */
  batchClientRef?: string | null
}

/**
 * Structured API usage line for billing / analytics (stored in `security_logs`).
 */
export async function logApiUsageEvent(input: ApiUsageInput): Promise<void> {
  await logSecurityEvent({
    userId: input.userId,
    apiKeyId: input.apiKeyId ?? null,
    action: 'api_usage',
    resource: input.endpoint,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: {
      method: input.method,
      status: input.statusCode,
      duration_ms: input.durationMs,
      priority: input.priority ?? false,
      ...(input.batchClientRef ? { client_ref: input.batchClientRef } : {}),
    },
  })
}
