import { z } from 'zod'
import type { RawMessage } from '@cryptocheck/signal-contracts'
import type { ParseCandidate } from './types.js'

const LlmOutputSchema = z.object({
  chain: z.enum(['solana', 'ethereum', 'base', 'bsc', 'arbitrum']),
  contractAddress: z.string().min(20).max(64),
  tokenSymbol: z.string().min(1).max(20),
  signalType: z.enum(['buy', 'sell', 'mention']),
  price: z.number().positive().optional(),
  pair: z.string().max(64).optional(),
  confidence: z.number().min(0).max(1),
})

const SYSTEM_PROMPT = `You extract crypto TOKEN signals from Telegram messages.
Return ONLY valid JSON matching the schema. MVP is crypto tokens only — no forex or stocks.
If no contract address can be identified, return confidence 0 and contractAddress "".
Never invent addresses or prices.`

export async function parseWithLlm(raw: RawMessage): Promise<ParseCandidate | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const model = process.env.SIGNAL_LLM_MODEL?.trim() || 'gpt-4o-mini'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'normalized_signal_extract',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              chain: { type: 'string', enum: ['solana', 'ethereum', 'base', 'bsc', 'arbitrum'] },
              contractAddress: { type: 'string' },
              tokenSymbol: { type: 'string' },
              signalType: { type: 'string', enum: ['buy', 'sell', 'mention'] },
              price: { type: 'number' },
              pair: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['chain', 'contractAddress', 'tokenSymbol', 'signalType', 'confidence'],
          },
        },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Channel: ${raw.channel}\nMessage:\n${raw.text}`,
        },
      ],
    }),
  })

  if (!res.ok) return null

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = body.choices?.[0]?.message?.content
  if (!content) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  const validated = LlmOutputSchema.safeParse(parsed)
  if (!validated.success) return null

  const v = validated.data
  if (!v.contractAddress || v.confidence < 0.5) return null

  return {
    chain: v.chain,
    contractAddress: v.contractAddress,
    tokenSymbol: v.tokenSymbol.toUpperCase(),
    pair: v.pair,
    price: v.price,
    signalType: v.signalType,
    confidence: Math.min(v.confidence, 0.85),
    parseMethod: 'llm',
  }
}
