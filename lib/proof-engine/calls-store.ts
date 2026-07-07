import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { ProofCallTrackRecord, SignalProofCall } from '@cryptocheck/signal-contracts'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function rowToCall(row: Record<string, unknown>): SignalProofCall {
  return {
    id: String(row.id),
    signalId: String(row.signal_id),
    mint: String(row.mint),
    symbol: String(row.symbol),
    callType: row.call_type as SignalProofCall['callType'],
    verdict: row.verdict as SignalProofCall['verdict'],
    neuralScore: Number(row.neural_score ?? 0),
    evidenceSummary: String(row.evidence_summary ?? ''),
    calledAt: String(row.called_at),
    commitTx: String(row.commit_tx),
    dataHash: String(row.data_hash),
    commitmentHash: String(row.commitment_hash),
    hmacSignature: row.hmac_signature ? String(row.hmac_signature) : undefined,
    explorerUrl: row.explorer_url ? String(row.explorer_url) : undefined,
    outcome: row.outcome as SignalProofCall['outcome'],
    outcomeEvidence: row.outcome_evidence ? String(row.outcome_evidence) : undefined,
    gradedAt: row.graded_at ? String(row.graded_at) : undefined,
    priceAtCall: row.price_at_call != null ? Number(row.price_at_call) : undefined,
    priceAtGrade: row.price_at_grade != null ? Number(row.price_at_grade) : undefined,
    sample: row.sample === true,
  }
}

export async function fetchProofCallById(id: string): Promise<SignalProofCall | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb.from('signal_proof_calls').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return rowToCall(data as Record<string, unknown>)
}

export async function buildProofTrackRecord(limit = 12): Promise<ProofCallTrackRecord> {
  const sb = getSupabase()
  if (!sb) {
    return {
      hitRate: null,
      callsThisMonth: 0,
      pending: 0,
      hits: 0,
      misses: 0,
      avgLeadTimeMinutes: null,
      calls: [],
    }
  }

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const { data, error } = await sb
    .from('signal_proof_calls')
    .select('*')
    .eq('sample', false)
    .gte('called_at', monthStart.toISOString())
    .order('called_at', { ascending: false })
    .limit(Math.max(limit, 50))

  if (error || !data) {
    return {
      hitRate: null,
      callsThisMonth: 0,
      pending: 0,
      hits: 0,
      misses: 0,
      avgLeadTimeMinutes: null,
      calls: [],
    }
  }

  const calls = data.map((r) => rowToCall(r as Record<string, unknown>))
  const hits = calls.filter((c) => c.outcome === 'hit').length
  const misses = calls.filter((c) => c.outcome === 'miss').length
  const pending = calls.filter((c) => c.outcome === 'pending').length
  const graded = hits + misses
  const hitRate = graded > 0 ? Math.round((hits / graded) * 1000) / 10 : null

  const leadTimes = calls
    .filter((c) => c.outcome === 'hit' && c.gradedAt)
    .map((c) => (new Date(c.gradedAt!).getTime() - new Date(c.calledAt).getTime()) / 60_000)
    .filter((m) => Number.isFinite(m) && m >= 0)

  const avgLeadTimeMinutes =
    leadTimes.length > 0
      ? Math.round((leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) * 10) / 10
      : null

  return {
    hitRate,
    callsThisMonth: calls.length,
    pending,
    hits,
    misses,
    avgLeadTimeMinutes,
    calls: calls.slice(0, limit),
  }
}
