import type { NormalizedSignal, ParsedStreamEntry } from '@cryptocheck/signal-contracts'

export type { ParsedStreamEntry }

export type ParseCandidate = {
  chain: NormalizedSignal['chain']
  contractAddress: string
  tokenSymbol: string
  pair?: string
  price?: number
  signalType: NormalizedSignal['signalType']
  confidence: number
  parseMethod: NormalizedSignal['parseMethod']
}

export type ParseAttempt = {
  candidate: ParseCandidate | null
  parseMethod: NormalizedSignal['parseMethod'] | null
  reason?: string
}
