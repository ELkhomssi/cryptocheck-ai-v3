import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedSignal } from '@cryptocheck/signal-contracts'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for enrich worker')
  }
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

function toRow(signal: NormalizedSignal) {
  return {
    id: signal.id,
    source_channel: signal.sourceChannel,
    source_message_id: signal.sourceMessageId,
    chain: signal.chain,
    contract_address: signal.contractAddress,
    token_symbol: signal.tokenSymbol,
    pair: signal.pair ?? null,
    price: signal.price ?? null,
    signal_type: signal.signalType,
    confidence: signal.confidence,
    parse_method: signal.parseMethod,
    raw_text: signal.rawText,
    msg_timestamp: signal.msgTimestamp,
    ingest_timestamp: signal.ingestTimestamp,
    resolved: signal.resolved,
    sentinel_verdict: signal.sentinelVerdict,
    neural_score: signal.neuralScore ?? null,
    sources: signal.sources,
    source_count: signal.sourceCount,
    sample: signal.sample === true,
    dropped: signal.dropped === true,
    drop_reason: signal.dropReason ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function upsertSignal(signal: NormalizedSignal): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('signal_normalized').upsert(toRow(signal), { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export async function deleteSignalById(id: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('signal_normalized').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSignalByMessage(channel: string, messageId: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb
    .from('signal_normalized')
    .delete()
    .eq('source_channel', channel)
    .eq('source_message_id', messageId)
  if (error) throw new Error(error.message)
}
