import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { SavedYouRow } from './saved-you-types'

export type { SavedYouRow } from './saved-you-types'

export type UserBlockRow = {
  id: string
  userId: string | null
  mint: string
  symbol: string | null
  verdict: string
  score: number | null
  evidence: string | null
  source: 'swap' | 'snipe' | 'manual' | 'watch'
  intendedAmountUsd: number | null
  blockedAt: string
  outcome: 'pending' | 'rugged' | 'survived' | 'expired'
  gradedAt: string | null
}

export async function logUserBlock(input: {
  userId?: string | null
  mint: string
  symbol?: string
  verdict: string
  score?: number
  evidence?: string
  source: 'swap' | 'snipe' | 'manual' | 'watch'
  intendedAmountUsd?: number
}): Promise<string | null> {
  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('user_blocks')
      .insert({
        user_id: input.userId ?? null,
        mint: input.mint,
        symbol: input.symbol ?? null,
        verdict: input.verdict,
        score: input.score ?? null,
        evidence: input.evidence ?? null,
        source: input.source,
        intended_amount_usd: input.intendedAmountUsd ?? null,
        outcome: 'pending',
      })
      .select('id')
      .single()
    if (error) {
      console.error('[saved-you] logUserBlock', error.message)
      return null
    }
    return data?.id ?? null
  } catch (e) {
    console.error('[saved-you] logUserBlock', e)
    return null
  }
}

export async function listPendingBlocks(limit = 40): Promise<
  Array<{
    id: string
    user_id: string | null
    mint: string
    symbol: string | null
    verdict: string
    score: number | null
    evidence: string | null
    intended_amount_usd: number | null
    blocked_at: string
  }>
> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('user_blocks')
    .select('id,user_id,mint,symbol,verdict,score,evidence,intended_amount_usd,blocked_at')
    .eq('outcome', 'pending')
    .order('blocked_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function markBlockOutcome(
  blockId: string,
  outcome: 'rugged' | 'survived' | 'expired',
): Promise<void> {
  const sb = getSupabaseAdmin()
  await sb
    .from('user_blocks')
    .update({ outcome, graded_at: new Date().toISOString() })
    .eq('id', blockId)
}

export async function insertSavedYou(input: {
  blockId: string
  userId: string | null
  mint: string
  symbol: string | null
  blockedAt: string
  priceAtBlock: number | null
  priceAtGrade: number | null
  drawdownPct: number | null
  lossAvoidedEstimate: number | null
  outcomeEvidence: string
  explorerUrl: string | null
}): Promise<SavedYouRow | null> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('saved_you')
    .insert({
      block_id: input.blockId,
      user_id: input.userId,
      mint: input.mint,
      symbol: input.symbol,
      blocked_at: input.blockedAt,
      price_at_block: input.priceAtBlock,
      price_at_grade: input.priceAtGrade,
      drawdown_pct: input.drawdownPct,
      loss_avoided_estimate: input.lossAvoidedEstimate,
      outcome_evidence: input.outcomeEvidence,
      explorer_url: input.explorerUrl,
    })
    .select('*')
    .single()
  if (error) {
    console.error('[saved-you] insert', error.message)
    return null
  }
  return mapSaved(data as Record<string, unknown>)
}

export async function listSavedYouForUser(
  userId: string | null,
  limit = 30,
): Promise<SavedYouRow[]> {
  const sb = getSupabaseAdmin()
  let q = sb.from('saved_you').select('*').order('graded_at', { ascending: false }).limit(limit)
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapSaved(r as Record<string, unknown>))
}

export async function getSavedYouById(id: string): Promise<SavedYouRow | null> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb.from('saved_you').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return mapSaved(data as Record<string, unknown>)
}

export async function getSaveRateStats(): Promise<{
  blocks: number
  rugged: number
  survived: number
  pending: number
  saveRatePct: number | null
}> {
  const sb = getSupabaseAdmin()
  const { data } = await sb.from('user_blocks').select('outcome')
  const rows = data ?? []
  const blocks = rows.length
  const rugged = rows.filter((r) => r.outcome === 'rugged').length
  const survived = rows.filter((r) => r.outcome === 'survived').length
  const pending = rows.filter((r) => r.outcome === 'pending').length
  const graded = rugged + survived
  return {
    blocks,
    rugged,
    survived,
    pending,
    saveRatePct: graded > 0 ? Math.round((rugged / graded) * 1000) / 10 : null,
  }
}

function mapSaved(r: Record<string, unknown>): SavedYouRow {
  return {
    id: String(r.id),
    blockId: String(r.block_id),
    userId: r.user_id != null ? String(r.user_id) : null,
    mint: String(r.mint),
    symbol: r.symbol != null ? String(r.symbol) : null,
    blockedAt: String(r.blocked_at),
    gradedAt: String(r.graded_at),
    priceAtBlock: r.price_at_block != null ? Number(r.price_at_block) : null,
    priceAtGrade: r.price_at_grade != null ? Number(r.price_at_grade) : null,
    drawdownPct: r.drawdown_pct != null ? Number(r.drawdown_pct) : null,
    lossAvoidedEstimate: r.loss_avoided_estimate != null ? Number(r.loss_avoided_estimate) : null,
    outcomeEvidence: String(r.outcome_evidence ?? ''),
    explorerUrl: r.explorer_url != null ? String(r.explorer_url) : null,
  }
}
