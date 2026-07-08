import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SnipeActionRecord } from '@cryptocheck/signal-contracts'

let client: SupabaseClient | null = null

function getSupabase(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export async function logSnipeAction(row: SnipeActionRecord): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const { error } = await sb.from('signal_snipe_actions').insert({
    user_id: row.userId ?? null,
    signal_id: row.signalId,
    mint: row.mint,
    symbol: row.symbol,
    action: row.action,
    allowed: row.allowed,
    neural_score: Math.round(row.neuralScore),
    verdict: row.verdict,
    red_flags: row.redFlags,
    evidence_summary: row.evidenceSummary,
    blocked_reason: row.blockedReason ?? null,
    tx_signature: row.txSignature ?? null,
    created_at: row.createdAt,
  })
  if (error) {
    console.error('[signal-sniper] audit insert failed', error.message)
    return false
  }
  return true
}
