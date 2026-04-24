import 'server-only'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { scanTokenIntelligence } from '@/lib/services/scanner/execute-scan'
import { fetchWhaleFlowForMint } from '@/lib/services/whale/fetch-whale-flow'
import { buildRelationshipGraph } from '@/lib/services/whale/relationship-graph'
import { fetchTokenMetricsWithPair } from '@/lib/dexscreener/fetch-token-metrics'
import { detectLiquidityLock } from '@/lib/sentinel/liquidity-lock'
import { complete } from '@/lib/services/ai/openai-client'

const ReportSchema = z.object({
  report: z.string().min(80).max(3000),
})

async function logUsage(userId: string, feature: string, model = 'internal-tool') {
  try {
    const sb = getSupabaseAdmin()
    await sb.from('ai_usage').insert({
      user_id: userId,
      feature,
      model,
      prompt_tokens: null,
      completion_tokens: null,
      cost_usd: null,
    })
  } catch {
    // best effort
  }
}

type StreamEvent =
  | { type: 'tool'; toolName: string; state: 'running' | 'result'; detail: string }
  | { type: 'text'; content: string }
  | { type: 'done' }

export function runInvestigationStream(params: { mint: string; userId: string }): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        push({ type: 'tool', toolName: 'scanTokenSecurity', state: 'running', detail: 'Running Sentinel risk scan...' })
        const scan = await scanTokenIntelligence({ mint: params.mint, mode: 'full' })
        await logUsage(params.userId, 'investigation_tool:scanTokenSecurity')
        push({
          type: 'tool',
          toolName: 'scanTokenSecurity',
          state: 'result',
          detail: `Risk ${scan.riskScore} (${scan.verdict}).`,
        })

        push({ type: 'tool', toolName: 'fetchWhaleFlow', state: 'running', detail: 'Tracing smart-money flow (24h)...' })
        const whaleFlow = await fetchWhaleFlowForMint(params.mint, { hoursBack: 24, limit: 50 })
        await logUsage(params.userId, 'investigation_tool:fetchWhaleFlow')
        const netFlow = whaleFlow.reduce((sum, tx) => sum + (tx.action === 'bought' ? 1 : -1) * (tx.amountUsd ?? 0), 0)
        push({
          type: 'tool',
          toolName: 'fetchWhaleFlow',
          state: 'result',
          detail: `${whaleFlow.length} txs, net flow ${Math.round(netFlow).toLocaleString()} USD.`,
        })

        push({ type: 'tool', toolName: 'queryRelationshipGraph', state: 'running', detail: 'Building wallet-token graph...' })
        const graph = await buildRelationshipGraph(params.mint)
        await logUsage(params.userId, 'investigation_tool:queryRelationshipGraph')
        push({
          type: 'tool',
          toolName: 'queryRelationshipGraph',
          state: 'result',
          detail: `${graph.nodes.length} nodes, ${graph.edges.length} edges.`,
        })

        push({ type: 'tool', toolName: 'checkLiquidityLock', state: 'running', detail: 'Checking LP lock status...' })
        const metrics = await fetchTokenMetricsWithPair(params.mint).catch(() => ({ pair: null }))
        const lock = await detectLiquidityLock(metrics.pair ?? null)
        await logUsage(params.userId, 'investigation_tool:checkLiquidityLock')
        push({
          type: 'tool',
          toolName: 'checkLiquidityLock',
          state: 'result',
          detail: `Liquidity status: ${lock.status}.`,
        })

        push({ type: 'tool', toolName: 'matchHistoricalPatterns', state: 'running', detail: 'Matching historical patterns...' })
        const sb = getSupabaseAdmin()
        const { data: recentSignals } = await sb
          .from('intelligence_signals')
          .select('mint,verdict,generated_at')
          .order('generated_at', { ascending: false })
          .limit(100)
        await logUsage(params.userId, 'investigation_tool:matchHistoricalPatterns')
        push({
          type: 'tool',
          toolName: 'matchHistoricalPatterns',
          state: 'result',
          detail: `Compared against ${(recentSignals ?? []).length} historical signal records.`,
        })

        push({ type: 'tool', toolName: 'synthesizeReport', state: 'running', detail: 'Synthesizing forensic report...' })
        const reportObj = await complete({
          systemPrompt:
            'You are a forensic Solana analyst. Produce factual observations only. Never include buy/sell/target/probability language. End with: "Informational only. Not financial advice."',
          userMessage: JSON.stringify(
            {
              mint: params.mint,
              security: { riskScore: scan.riskScore, verdict: scan.verdict, topSignals: scan.topSignals?.slice(0, 6) ?? [] },
              whales: {
                txCount: whaleFlow.length,
                uniqueWallets: new Set(whaleFlow.map((t) => t.walletAddress)).size,
                netFlowUsd: Math.round(netFlow),
              },
              relationshipGraph: { nodes: graph.nodes.length, edges: graph.edges.length },
              liquidityLock: lock,
              historicalMatches: (recentSignals ?? []).slice(0, 10),
            },
            null,
            2
          ),
          schema: ReportSchema,
          model: 'gpt-4o-mini',
          temperature: 0.2,
          userId: params.userId,
          feature: 'investigation_synthesis',
        })
        await logUsage(params.userId, 'investigation_tool:synthesizeReport', 'gpt-4o-mini')
        push({ type: 'tool', toolName: 'synthesizeReport', state: 'result', detail: 'Final report generated.' })
        push({ type: 'text', content: reportObj.report })
        push({ type: 'done' })
        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Investigation failed'
        push({ type: 'text', content: `Investigation unavailable right now: ${message}` })
        push({ type: 'done' })
        controller.close()
      }
    },
  })
}
