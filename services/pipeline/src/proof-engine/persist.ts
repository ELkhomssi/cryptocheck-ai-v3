import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SignalProofCall } from '@cryptocheck/signal-contracts'

let client: SupabaseClient | null = null

function getSupabase(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export type InsertProofCall = {
  id: string
  signalId: string
  mint: string
  symbol: string
  callType: string
  verdict: string
  neuralScore: number
  evidenceSummary: string
  calledAt: string
  commitTx: string
  dataHash: string
  commitmentHash: string
  hmacSignature?: string
  explorerUrl?: string
  priceAtCall?: number
}

export async function insertProofCall(row: InsertProofCall): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) {
    console.warn('[proof-engine] Supabase not configured — call not persisted')
    return false
  }

  const { error } = await sb.from('signal_proof_calls').insert({
    id: row.id,
    signal_id: row.signalId,
    mint: row.mint,
    symbol: row.symbol,
    call_type: row.callType,
    verdict: row.verdict,
    neural_score: row.neuralScore,
    evidence_summary: row.evidenceSummary,
    called_at: row.calledAt,
    commit_tx: row.commitTx,
    data_hash: row.dataHash,
    commitment_hash: row.commitmentHash,
    hmac_signature: row.hmacSignature ?? null,
    explorer_url: row.explorerUrl ?? null,
    outcome: 'pending',
    price_at_call: row.priceAtCall ?? null,
    sample: false,
  })

  if (error) {
    console.error('[proof-engine] insert failed', error.message)
    return false
  }
  return true
}

export async function updateProofCallOutcome(
  id: string,
  outcome: 'hit' | 'miss' | 'expired',
  evidence: string,
  priceAtGrade?: number,
): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  await sb
    .from('signal_proof_calls')
    .update({
      outcome,
      outcome_evidence: evidence,
      graded_at: new Date().toISOString(),
      price_at_grade: priceAtGrade ?? null,
    })
    .eq('id', id)
}

export async function fetchPendingProofCalls(limit = 50): Promise<SignalProofCall[]> {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from('signal_proof_calls')
    .select('*')
    .eq('outcome', 'pending')
    .eq('sample', false)
    .order('called_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return data.map(rowToProofCall)
}

function rowToProofCall(row: Record<string, unknown>): SignalProofCall {
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
  return rowToProofCall(data as Record<string, unknown>)
}

export async function fetchRecentProofCalls(limit = 20): Promise<SignalProofCall[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('signal_proof_calls')
    .select('*')
    .eq('sample', false)
    .order('called_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((r) => rowToProofCall(r as Record<string, unknown>))
}
