import 'server-only'
import OpenAI from 'openai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured (set OPENAI_API_KEY or legacy OPENAI_KEY)')
  client = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 2 })
  return client
}

export async function complete<T>(params: {
  systemPrompt: string
  userMessage: string
  schema: z.ZodSchema<T>
  /** Map model JSON into the shape expected by `schema` (e.g. move `analysis` → `report`). */
  preprocessParsed?: (parsed: unknown) => unknown
  model?: 'gpt-4o-mini' | 'gpt-4o'
  temperature?: number
  userId?: string
  feature?: string
}): Promise<T> {
  const openai = getOpenAIClient()
  const model = params.model ?? 'gpt-4o-mini'

  const response = await openai.chat.completions.create({
    model,
    temperature: params.temperature ?? 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userMessage },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenAI')

  // Log cost (fail silently)
  if (params.userId && params.feature && response.usage) {
    logAIUsage({
      userId: params.userId,
      feature: params.feature,
      model,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
    }).catch(() => {})
  }

  const parsed = JSON.parse(content) as unknown
  const shaped = params.preprocessParsed ? params.preprocessParsed(parsed) : parsed
  return params.schema.parse(shaped)
}

async function logAIUsage(params: {
  userId: string
  feature: string
  model: string
  promptTokens: number
  completionTokens: number
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // gpt-4o-mini: $0.15/1M input, $0.60/1M output
  const costUsd =
    (params.promptTokens / 1_000_000) * 0.15 +
    (params.completionTokens / 1_000_000) * 0.60

  await supabase.from('ai_usage').insert({
    user_id: params.userId,
    feature: params.feature,
    model: params.model,
    prompt_tokens: params.promptTokens,
    completion_tokens: params.completionTokens,
    cost_usd: costUsd,
  })
}
