import 'server-only'

import { createClient } from '@supabase/supabase-js'

export type HealthCheck = { ok: boolean; ms?: number; error?: string }

export type HealthSnapshot = {
  status: 'healthy' | 'degraded'
  latency_ms: number
  checks: Record<string, HealthCheck>
  service: string
  ts: string
}

/**
 * Shared dependency checks for `/api/health` and the public status page.
 */
export async function collectHealthSnapshot(): Promise<HealthSnapshot> {
  const started = Date.now()
  const checks: Record<string, HealthCheck> = {}

  try {
    const t0 = Date.now()
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await sb.from('profiles').select('id').limit(1)
    checks.database = { ok: !error, ms: Date.now() - t0, error: error?.message }
  } catch (e: unknown) {
    checks.database = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  try {
    const t0 = Date.now()
    const key = process.env.HELIUS_API_KEY
    if (!key) {
      checks.rpc_primary = { ok: false, error: 'HELIUS_API_KEY not configured' }
    } else {
      const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [] }),
        signal: AbortSignal.timeout(8000),
      })
      const d = (await r.json()) as { error?: { message?: string } }
      checks.rpc_primary = {
        ok: r.ok && !d.error,
        ms: Date.now() - t0,
        error: d.error?.message,
      }
    }
  } catch (e: unknown) {
    checks.rpc_primary = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const t0 = Date.now()
      const { Redis } = await import('@upstash/redis')
      const redis = Redis.fromEnv()
      await redis.ping()
      checks.redis = { ok: true, ms: Date.now() - t0 }
    } else {
      checks.redis = { ok: true, error: 'not_configured (using in-memory rate limits)' }
    }
  } catch (e: unknown) {
    checks.redis = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  const criticalOk = checks.database?.ok !== false && checks.rpc_primary?.ok !== false

  return {
    status: criticalOk ? 'healthy' : 'degraded',
    latency_ms: Date.now() - started,
    checks,
    service: 'cryptocheck-ai',
    ts: new Date().toISOString(),
  }
}
