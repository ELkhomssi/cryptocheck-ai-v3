import type { RawMessage } from '@cryptocheck/signal-contracts'
import type { ParseCandidate } from '../types.js'

export type ChannelAdapter = {
  /** Public @channel username(s) this template handles. */
  channel: string | string[]
  parse(text: string, raw: RawMessage): ParseCandidate | null
}
