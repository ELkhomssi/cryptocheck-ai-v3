import 'server-only'
import { fetchWhaleFlowForMint } from '@/lib/services/whale/fetch-whale-flow'
import { complete } from '@/lib/services/ai/openai-client'
import { SIGNAL_CONSENSUS_PROMPT } from '@/lib/services/ai/prompts/signal-consensus.prompt'
import { SignalSchema, type Signal } from '@/lib/services/ai/schemas/signal.schema'
import { createClient } from '@supabase/supabase-js'

export async function generateSignalForMint(params: {
  mint: string
  userId?: string
  securityScore?: number
}): Promise<Signal> {
  const { mint, userId, securityScore } = params

  // 1. Fetch whale flow
  const flow = await fetchWhaleFlowForMint(mint, { hoursBack: 24, limit: 100 })

  if (flow.length === 0) {
    const quietSignal: Signal = {
      mint,
      verdict: 'quiet',
      summary: 'No smart-money activity detected in the last 24h.',
      confidencePct: 100,
      whaleCount: 0,
      netFlowUsd: 0,
      observations: [],
      patterns: [],
      disclaimer: 'Informational only. Not financial advice. Do your own research.',
    }
    await persistSignal(quietSignal)
    return quietSignal
  }

  // 2. Compute aggregates
  const uniqueWallets = new Set(flow.map((tx) => tx.walletAddress)).size
  const netFlow = flow.reduce((sum, tx) => {
    const mult = tx.action === 'bought' ? 1 : -1
    return sum + (tx.amountUsd ?? 0) * mult
  }, 0)

  // 3. AI analysis
  const userMessage = JSON.stringify(
    {
      mint,
      securityScore: securityScore ?? null,
      whaleCount: uniqueWallets,
      netFlowUsd: netFlow,
      transactions: flow.slice(0, 30), // top 30 for token budget
    },
    null,
    2
  )

  const signal = await complete({
    systemPrompt: SIGNAL_CONSENSUS_PROMPT,
    userMessage,
    schema: SignalSchema,
    model: 'gpt-4o-mini',
    temperature: 0.2,
    userId,
    feature: 'signal_generation',
  })

  await persistSignal(signal)
  return signal
}

async function persistSignal(signal: Signal) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase.from('intelligence_signals').insert({
    mint: signal.mint,
    signal_type: signal.verdict.includes('bullish')
      ? 'entry'
      : signal.verdict.includes('bearish')
        ? 'exit'
        : signal.verdict === 'cautionary_flags'
          ? 'caution'
          : 'neutral',
    verdict: signal.verdict,
    confidence_pct: signal.confidencePct,
    whale_count: signal.whaleCount,
    net_flow_usd: signal.netFlowUsd,
    ai_reasoning: signal.summary,
    patterns_matched: signal.patterns,
    data_sources: { whale_flow: true, ai_model: 'gpt-4o-mini' },
    valid_until: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  })
  if (error) {
    console.error('[signals] intelligence_signals insert failed:', error.message, error)
  }
}
