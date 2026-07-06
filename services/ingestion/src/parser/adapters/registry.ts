import type { RawMessage } from '@cryptocheck/signal-contracts'
import type { ChannelAdapter } from './types.js'
import { callFormatAdapter } from './call-format.js'

const ADAPTERS: ChannelAdapter[] = [callFormatAdapter]

function normalizeChannel(channel: string): string {
  const t = channel.trim()
  return t.startsWith('@') ? t.toLowerCase() : `@${t.toLowerCase()}`
}

export function parseWithAdapter(raw: RawMessage): ReturnType<ChannelAdapter['parse']> {
  const channel = normalizeChannel(raw.channel)
  for (const adapter of ADAPTERS) {
    const channels = Array.isArray(adapter.channel) ? adapter.channel : [adapter.channel]
    const hit = channels.some((c: string) => normalizeChannel(c) === channel)
    if (!hit) continue
    const result = adapter.parse(raw.text ?? '', raw)
    if (result) return result
  }
  return null
}
