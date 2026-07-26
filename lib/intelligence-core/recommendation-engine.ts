/**
 * Phase 17.4 — RecommendationEngine
 * Every causal explanation requires an explicit before/after DIFFER of real metrics.
 * Score-only changes without underlying diffs → honest fallback (never fabricate).
 *
 * Grep findings (reuse):
 * - agent_predictions (Phase 11/16) for storing pending recommendations
 * - Does NOT create a parallel recommendations table
 */

import 'server-only'

import { insertPrediction } from '@/lib/agents/store'
import { explainFromGrounding } from '@/lib/intelligence-core/recommendation-grounding'
import {
  NO_DIFF_EXPLANATION,
  type RecommendationGrounding,
  type RecommendationResult,
} from '@/types/intelligence-core'

export { explainFromGrounding } from '@/lib/intelligence-core/recommendation-grounding'

export async function generateGroundedRecommendation(params: {
  agentId?: string
  subject?: string | null
  grounding: RecommendationGrounding
  title?: string
}): Promise<RecommendationResult> {
  const { explanation, grounded } = explainFromGrounding(params.grounding)
  const title =
    params.title ||
    (grounded ? `${params.grounding.metric} change explained` : `${params.grounding.metric} update`)

  let predictionId: string | null = null
  if (grounded) {
    const agentId = params.agentId || 'risk-manager'
    await insertPrediction({
      agentId,
      kind: 'recommendation',
      subject: params.subject ?? null,
      payload: {
        title,
        explanation,
        grounding: params.grounding,
        grounded: true,
      },
      resolveAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    predictionId = null
  }

  return { title, explanation, grounded, predictionId }
}

/** Latest recommendations relevant to portfolio/watchlist (from agent_predictions). */
export async function listRecentRecommendations(limit = 5): Promise<RecommendationResult[]> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('agent_predictions')
      .select('id, payload, kind, created_at')
      .eq('kind', 'recommendation')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data?.length) return []
    return data.map((row) => {
      const payload = (row.payload as Record<string, unknown>) ?? {}
      return {
        title: typeof payload.title === 'string' ? payload.title : 'Recommendation',
        explanation:
          typeof payload.explanation === 'string' ? payload.explanation : NO_DIFF_EXPLANATION,
        grounded: payload.grounded === true,
        predictionId: String(row.id),
      }
    })
  } catch {
    return []
  }
}
