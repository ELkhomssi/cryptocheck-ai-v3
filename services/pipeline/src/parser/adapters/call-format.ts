import type { ChannelAdapter } from './types.js'

/**
 * High-volume call-channel template:
 *   🟢 BUY $TICKER
 *   CA: <mint>
 *   Entry: $0.0012
 */
export const callFormatAdapter: ChannelAdapter = {
  channel: ['@call_format_example'],
  parse(text) {
    const typeMatch = text.match(/🟢|🟡|🔴|BUY|SELL/i)
    const caMatch = text.match(/(?:CA|Contract|Mint)\s*:?\s*([1-9A-HJ-NP-Za-km-z]{32,44}|0x[a-fA-F0-9]{40})/i)
    if (!caMatch?.[1]) return null

    const ca = caMatch[1]
    const chain = ca.startsWith('0x') ? 'ethereum' : 'solana'
    const ticker = text.match(/\$([A-Za-z][A-Za-z0-9]{0,14})/)?.[1]?.toUpperCase() ?? 'TOKEN'
    const price = text.match(/(?:entry|price)\s*:?\s*\$?(\d+(?:\.\d+)?)/i)?.[1]
    const signalType = /sell|🔴/i.test(text) ? 'sell' : /buy|🟢/i.test(text) ? 'buy' : 'mention'

    return {
      chain,
      contractAddress: ca,
      tokenSymbol: ticker,
      price: price ? Number(price) : undefined,
      signalType,
      confidence: 0.99,
      parseMethod: 'adapter',
    }
  },
}
