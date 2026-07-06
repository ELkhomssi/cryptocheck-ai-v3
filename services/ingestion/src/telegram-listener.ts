/**
 * @deprecated Prompt 1 — use TelegramAdapter + telegram-gram-listener instead.
 * Legacy raw-stream path retained for pipeline parser until unified gate (Prompt 3).
 */
import type { IngestionConfig } from './config.js'
import type { RawStreamWriter } from './redis-stream.js'
import { startTelegramGramListener } from './telegram-gram-listener.js'
import type { RawMessage } from '@cryptocheck/signal-contracts'
import { markDropped } from './stats.js'

export type TelegramListener = {
  stop(): Promise<void>
}

/** @deprecated Use TelegramAdapter */
export async function startTelegramListener(
  config: IngestionConfig,
  writer: RawStreamWriter,
): Promise<TelegramListener> {
  const enqueue = (envelope: RawMessage): void => {
    void writer.xaddRaw(envelope).catch((e) => {
      const msg = e instanceof Error ? e.message : 'xadd failed'
      markDropped(msg)
      console.error('[signal-ingestion] redis xadd failed', { error: msg, channel: envelope.channel })
    })
  }

  if (!config.telegram) throw new Error('startTelegramListener requires telegram config')

  const listener = await startTelegramGramListener(config.telegram, enqueue)
  return {
    async stop() {
      await listener.stop()
    },
  }
}
