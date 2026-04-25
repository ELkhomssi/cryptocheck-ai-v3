import { z } from 'zod'

export const WhaleObservationSchema = z.object({
  timestamp: z.string(),
  walletAddress: z.string(),
  walletLabel: z.string().optional(),
  action: z.enum(['bought', 'sold', 'transferred']),
  amountTokens: z.number(),
  amountUsd: z.number().optional(),
})

export const PatternMatchSchema = z.object({
  patternName: z.string(),
  description: z.string(),
  historicalExample: z.string(),
})

export const SignalSchema = z.object({
  mint: z.string(),
  verdict: z.enum([
    'bullish_activity',
    'bearish_activity',
    'mixed_activity',
    'quiet',
    'cautionary_flags',
  ]),
  summary: z.string().max(300),
  confidencePct: z.number().min(0).max(100),
  whaleCount: z.number(),
  netFlowUsd: z.number(),
  observations: z.array(WhaleObservationSchema).max(20),
  patterns: z.array(PatternMatchSchema).max(3),
  disclaimer: z.literal(
    'Informational only. Not financial advice. Do your own research.'
  ),
})

export type Signal = z.infer<typeof SignalSchema>
