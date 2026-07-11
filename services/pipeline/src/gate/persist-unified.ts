import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { getSupabase } from '../lib/supabase-client.js'

function parseMethod(signal: UnifiedSignal): 'regex' | 'adapter' | 'llm' {
  const m = signal.rawPayload?.parseMethod
  if (m === 'regex' || m === 'adapter' || m === 'llm') return m
  return 'adapter'
}

function tokenSignalType(signal: UnifiedSignal): 'buy' | 'sell' | 'mention' | null {
  if (signal.subjectType !== 'token') return null
  const t = String(signal.type)
  if (t === 'buy' || t === 'sell' || t === 'mention') return t
  return 'mention'
}

function toRow(signal: UnifiedSignal) {
  const sources = signal.sources?.length ? signal.sources : [signal.sourceTag]
  const isToken = signal.subjectType === 'token'
  const resolved =
    signal.verdict !== 'scanning' && signal.dropped !== true

  return {
    id: signal.id,
    source_tag: signal.sourceTag,
    source_ref: signal.sourceRef,
    subject_type: signal.subjectType,
    label: signal.label,
    event_type: String(signal.type),
    source_channel: sources[0] ?? signal.sourceTag,
    source_message_id: signal.sourceRef,
    chain: isToken ? (signal.chain ?? null) : null,
    contract_address: isToken ? (signal.contractAddress ?? null) : null,
    token_symbol: isToken ? (signal.tokenSymbol ?? signal.label) : null,
    pair: isToken && typeof signal.rawPayload?.pair === 'string' ? signal.rawPayload.pair : null,
    price: isToken ? (signal.value ?? null) : null,
    signal_type: tokenSignalType(signal),
    confidence: signal.confidence,
    parse_method: parseMethod(signal),
    raw_text: isToken
      ? typeof signal.rawPayload?.text === 'string'
        ? signal.rawPayload.text
        : null
      : signal.label,
    msg_timestamp: signal.msgTimestamp,
    ingest_timestamp: signal.ingestTimestamp,
    resolved,
    sentinel_verdict: signal.verdict,
    neural_score:
      isToken && signal.scoreValue != null ? Math.round(signal.scoreValue) : null,
    score_value: signal.scoreValue ?? null,
    match_id: signal.matchId ?? null,
    teams: signal.teams ?? null,
    score: signal.score ?? null,
    market: signal.market ?? null,
    raw_payload: signal.rawPayload ?? {},
    sources,
    source_count: signal.sourceCount ?? sources.length,
    sample: signal.sample === true,
    dropped: signal.dropped === true,
    drop_reason: signal.dropReason ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function upsertUnifiedSignal(signal: UnifiedSignal): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('signal_normalized').upsert(toRow(signal), { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export async function deleteUnifiedSignalById(id: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('signal_normalized').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
