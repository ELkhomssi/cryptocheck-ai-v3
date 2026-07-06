import type { SourceAdapter, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { RawMessage } from '@cryptocheck/signal-contracts'
import type { IngestionConfig, TelegramShardConfig } from '../config.js'
import { normalizeTelegramMessage } from '../parser/normalize-telegram.js'
import { markDropped } from '../stats.js'
import { startTelegramGramListener, type TelegramGramListener } from '../telegram-gram-listener.js'
import type { UnifiedStreamWriter } from '../unified-stream.js'

/**
 * Telegram → UnifiedSignal ingestion (Prompt 1).
 * GramJS + regex→adapter→LLM normalize; XADD to per-source + unified streams.
 */
export class TelegramAdapter implements SourceAdapter {
  readonly sourceTag = 'telegram' as const

  private telegram: TelegramShardConfig
  private writer: UnifiedStreamWriter
  private listener: TelegramGramListener | null = null

  constructor(config: IngestionConfig, writer: UnifiedStreamWriter) {
    if (!config.telegram) throw new Error('TelegramAdapter requires telegram config')
    this.telegram = config.telegram
    this.writer = writer
  }

  async start(emit: (signal: UnifiedSignal) => Promise<void>): Promise<void> {
    const onEnvelope = (envelope: RawMessage): void => {
      void this.handleEnvelope(envelope, emit)
    }

    this.listener = await startTelegramGramListener(this.telegram, onEnvelope)
  }

  private async handleEnvelope(
    envelope: RawMessage,
    emit: (signal: UnifiedSignal) => Promise<void>,
  ): Promise<void> {
    try {
      const signal = await normalizeTelegramMessage(envelope)
      if (!signal) return

      const streamId = await this.writer.xaddUnified(signal)
      if (streamId === null && !signal.dropped) return

      await emit(signal)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'normalize/xadd failed'
      markDropped(msg)
      console.error('[TelegramAdapter] handle envelope', {
        error: msg,
        channel: envelope.channel,
        messageId: envelope.messageId,
      })
    }
  }

  async stop(): Promise<void> {
    if (this.listener) {
      await this.listener.stop()
      this.listener = null
    }
  }
}
