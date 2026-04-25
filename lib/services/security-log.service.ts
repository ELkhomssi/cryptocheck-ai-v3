import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type SecurityLogInput = {
  userId?: string | null
  apiKeyId?: string | null
  apiKeyV2Id?: string | null
  action: string
  resource?: string | null
  ip?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}

export async function logSecurityEvent(input: SecurityLogInput): Promise<void> {
  try {
    const sb = getSupabaseAdmin()
    await sb.from('security_logs').insert({
      user_id: input.userId ?? null,
      api_key_id: input.apiKeyId ?? null,
      api_key_v2_id: input.apiKeyV2Id ?? null,
      action: input.action,
      resource: input.resource ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    })
  } catch (e) {
    console.error('[security-log]', e)
  }
}
