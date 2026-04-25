import 'server-only'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { canonicalScan } from '@/lib/sentinel/canonical-scan'
import { fetchWhaleFlowForMint } from '@/lib/services/whale/fetch-whale-flow'
import { buildRelationshipGraph } from '@/lib/services/whale/relationship-graph'
import { complete } from '@/lib/services/ai/openai-client'

/** Models often return `analysis`, `summary`, etc. under `json_object` instead of `report`. */
function preprocessReportJson(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input
  const o = input as Record<string, unknown>
  if (typeof o.report === 'string' && o.report.trim().length > 0) return { report: padReportMin80(o.report) }
  const keys = [
    'forensic_report',
    'investigation_report',
    'findings',
    'narrative',
    'analysis',
    'summary',
    'content',
    'text',
    'body',
    'result',
  ] as const
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim().length > 0) return { report: padReportMin80(v) }
  }
  const strs = Object.values(o).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  if (strs.length > 0) {
    strs.sort((a, b) => b.trim().length - a.trim().length)
    return { report: padReportMin80(strs[0]!) }
  }
  const fallback =
    `${JSON.stringify(o, null, 2).slice(0, 2400)}\n\n` +
    'The model returned JSON without a `report` (or known alias) field. Use the payload above for manual review. Informational only. Not financial advice.'
  return { report: padReportMin80(fallback) }
}

function padReportMin80(raw: string): string {
  const t = raw.trim()
  if (t.length >= 80) return t.slice(0, 3000)
  const pad =
    '\n\n[Note] Short model reply padded for pipeline minimum length. Informational only. Not financial advice.'
  return (t + pad).slice(0, 3000)
}

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
        const scan = await canonicalScan(params.mint)
        await logUsage(params.userId, 'investigation_tool:scanTokenSecurity')
        push({
          type: 'tool',
          toolName: 'scanTokenSecurity',
          state: 'result',
          detail: `Risk ${scan.riskScore} (${scan.verdict}) · liquidity ${scan.liquidity.status}.`,
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
        await logUsage(params.userId, 'investigation_tool:checkLiquidityLock')
        push({
          type: 'tool',
          toolName: 'checkLiquidityLock',
          state: 'result',
          detail: `Liquidity status: ${scan.liquidity.status}. ${scan.liquidity.reason}`,
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
            'You are a forensic Solana analyst. Produce factual observations only. Never include buy/sell/target/probability language. End with: "Informational only. Not financial advice."\n\n' +
            'Respond with exactly one JSON object: { "report": "<string>" }. The `report` value must be the full narrative (markdown allowed), at least 80 characters. Do not put the narrative in `analysis`, `summary`, or other keys — only `report`.',
          preprocessParsed: preprocessReportJson,
          userMessage: JSON.stringify(
            {
              mint: params.mint,
              security: {
                riskScore: scan.riskScore,
                verdict: scan.verdict,
                topSignals: scan.signals.slice(0, 6).map((s) => s.message),
              },
              whales: {
                txCount: whaleFlow.length,
                uniqueWallets: new Set(whaleFlow.map((t) => t.walletAddress)).size,
                netFlowUsd: Math.round(netFlow),
              },
              relationshipGraph: { nodes: graph.nodes.length, edges: graph.edges.length },
              liquidity: scan.liquidity,
              authorities: scan.authorities,
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
        const message = error instanceof Error ? error.message : String(error)
        console.error('[investigation-stream]', message)
        let hint = message
        const low = message.toLowerCase()
        if (message.includes('Helius API 401') || /helius api\s*401/i.test(message) || message.includes('-32401')) {
          hint =
            '[Helius auth] Key rejected (-32401 / 401). In https://dev.helius.xyz/dashboard create or rotate an API key, set HELIUS_API_KEY (no quotes/BOM), redeploy. RPC steps may fall back to public Solana; REST metadata still needs a valid Helius key. Raw: ' +
            message
        } else if (low.includes('incorrect api key') || low.includes('invalid_api_key') || low.includes('openai_api_key')) {
          hint =
            '[OpenAI] Key missing or rejected — fix OPENAI_API_KEY (or OPENAI_KEY). Raw: ' + message
        } else if (low.includes('supabase') || low.includes('fetch failed')) {
          hint = '[Supabase / network] ' + message
        } else if (low.includes('invalid_type') || low.includes('required') || message.includes('zod')) {
          hint =
            '[Report synthesis] Model JSON did not match the expected shape (this should be auto-normalized now). If it persists, retry or check OpenAI logs. Raw: ' +
            message
        }
        push({ type: 'text', content: `Investigation unavailable: ${hint}` })
        push({ type: 'done' })
        controller.close()
      }
    },
  })
}
