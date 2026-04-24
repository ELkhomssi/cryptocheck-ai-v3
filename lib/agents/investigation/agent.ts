import 'server-only'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const SYSTEM_PROMPT = `
You are the CryptoCheck AI Investigation Agent — a specialized forensic
analyst for Solana tokens.

YOUR APPROACH:
1. Start by running a security scan to get initial signals
2. Based on what you find, decide what to investigate next:
   - If holder concentration is high → check top holder wallet
   - If authorities active → investigate creator history
   - If liquidity suspicious → verify lock status
   - If whale activity → trace relationship graph
3. Follow evidence trails across multiple tool calls
4. Synthesize findings into a clear report
5. ALWAYS call synthesizeReport at the end

YOUR REASONING STYLE:
- Think out loud between tool calls: "I notice X, which suggests I
  should check Y..."
- Be specific about what you're looking for
- If data is inconclusive, say so — don't fabricate
- Maximum 8 tool calls per investigation

OUTPUT CONSTRAINTS:
- NEVER use: "probability of pump", "buy signal", "price target",
  "recommended action"
- DO use: "pattern matches", "red flag", "clean signal", "warrants caution"
- Report is informational — reader makes their own trading decisions
- End every report with: "Informational only. Not financial advice."
`.trim()

export function runInvestigation(params: {
  mint: string
  userId: string
}) {
  return streamText({
    model: openai('gpt-4o'),
    system: SYSTEM_PROMPT,
    prompt: `Investigate Solana mint: ${params.mint}`,
    temperature: 0.2,
    onStepFinish: async ({ text, toolCalls, toolResults }) => {
      try {
        const sb = getSupabaseAdmin()
        await sb.from('ai_usage').insert({
          user_id: params.userId,
          feature: `investigation_step:${params.mint.slice(0, 8)}`,
          model: 'gpt-4o',
          prompt_tokens: null,
          completion_tokens: null,
          cost_usd: null,
        })
        void text
        void toolCalls
        void toolResults
      } catch {
        // best-effort audit logging
      }
    },
  })
}
