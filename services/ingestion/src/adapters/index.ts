import type { SourceAdapter } from '@cryptocheck/signal-contracts'
import type { IngestionConfig } from '../config.js'
import { updateHealth } from '../health.js'
import type { UnifiedStreamWriter } from '../unified-stream.js'
import { TelegramAdapter } from './TelegramAdapter.js'
import { TxODDSAdapter } from './TxODDSAdapter.js'

export type RunningAdapter = {
  adapter: SourceAdapter
  writer: UnifiedStreamWriter
}

export function createAdapters(config: IngestionConfig, writers: Map<string, UnifiedStreamWriter>): RunningAdapter[] {
  const out: RunningAdapter[] = []

  if (config.telegram) {
    const writer = writers.get('telegram')
    if (!writer) throw new Error('missing unified stream writer for telegram')
    out.push({ adapter: new TelegramAdapter(config, writer), writer })
  }

  if (config.txodds) {
    const writer = writers.get('txodds')
    if (!writer) throw new Error('missing unified stream writer for txodds')
    out.push({ adapter: new TxODDSAdapter(config.txodds, writer), writer })
  }

  updateHealth({
    streams: {
      unified: writers.values().next().value?.unifiedStreamKey ?? '',
      sources: Object.fromEntries(
        [...writers.entries()].map(([tag, w]) => [tag, w.sourceStreamKey]),
      ),
    },
  })

  return out
}

export { TelegramAdapter } from './TelegramAdapter.js'
export { TxODDSAdapter } from './TxODDSAdapter.js'
