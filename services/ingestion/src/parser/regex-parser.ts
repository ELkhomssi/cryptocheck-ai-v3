import type { RawMessage } from '@cryptocheck/signal-contracts'
import type { ParseCandidate } from './types.js'

const SOL_BASE58 = /[1-9A-HJ-NP-Za-km-z]{32,44}/g
const EVM_ADDR = /0x[a-fA-F0-9]{40}/g
const TICKER = /\$([A-Za-z][A-Za-z0-9]{0,14})\b/
const PRICE_PATTERNS = [
  /(?:price|entry|at|mc)\s*:?\s*\$?\s*(\d+(?:\.\d+)?(?:e-?\d+)?)/i,
  /\$\s*(\d+(?:\.\d+)?(?:e-?\d+)?)\s*(?:usd|usdc)?/i,
]

const URL_EXTRACTORS: Array<{
  re: RegExp
  chain: ParseCandidate['chain']
}> = [
  { re: /pump\.fun\/(?:coin\/)?([1-9A-HJ-NP-Za-km-z]{32,44})/i, chain: 'solana' },
  { re: /dexscreener\.com\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})/i, chain: 'solana' },
  { re: /dexscreener\.com\/ethereum\/(0x[a-fA-F0-9]{40})/i, chain: 'ethereum' },
  { re: /dexscreener\.com\/base\/(0x[a-fA-F0-9]{40})/i, chain: 'base' },
  { re: /dexscreener\.com\/bsc\/(0x[a-fA-F0-9]{40})/i, chain: 'bsc' },
  { re: /dexscreener\.com\/arbitrum\/(0x[a-fA-F0-9]{40})/i, chain: 'arbitrum' },
  { re: /birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i, chain: 'solana' },
  { re: /solscan\.io\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i, chain: 'solana' },
]

const BUY_RE = /\b(buy|long|ape|aped|entry|called|call|accumulate)\b/i
const SELL_RE = /\b(sell|sold|exit|dump|short|take\s+profit|tp hit)\b/i

function collectUrls(raw: RawMessage): string[] {
  const urls: string[] = []
  for (const entity of raw.entities) {
    if (!entity || typeof entity !== 'object') continue
    const u = (entity as Record<string, unknown>).url
    if (typeof u === 'string') urls.push(u)
  }
  const textUrls = raw.text.match(/https?:\/\/[^\s)]+/gi) ?? []
  return [...urls, ...textUrls]
}

function isLikelySolanaMint(s: string): boolean {
  return s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function inferSignalType(text: string): ParseCandidate['signalType'] {
  if (SELL_RE.test(text)) return 'sell'
  if (BUY_RE.test(text)) return 'buy'
  return 'mention'
}

function extractPrice(text: string): number | undefined {
  for (const re of PRICE_PATTERNS) {
    const m = text.match(re)
    if (m?.[1]) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return undefined
}

function extractTicker(text: string): string {
  const m = text.match(TICKER)
  return m?.[1]?.toUpperCase() ?? 'TOKEN'
}

export function parseWithRegex(raw: RawMessage): ParseCandidate | null {
  const text = raw.text ?? ''
  if (!text.trim() && raw.eventType !== 'delete') return null

  const haystack = [text, ...collectUrls(raw)].join('\n')

  for (const { re, chain } of URL_EXTRACTORS) {
    const m = haystack.match(re)
    if (m?.[1]) {
      return {
        chain,
        contractAddress: m[1],
        tokenSymbol: extractTicker(text),
        price: extractPrice(text),
        signalType: inferSignalType(text),
        confidence: 0.95,
        parseMethod: 'regex',
      }
    }
  }

  const evm = haystack.match(EVM_ADDR)
  if (evm?.[0]) {
    return {
      chain: 'ethereum',
      contractAddress: evm[0],
      tokenSymbol: extractTicker(text),
      price: extractPrice(text),
      signalType: inferSignalType(text),
      confidence: 0.85,
      parseMethod: 'regex',
    }
  }

  const solMatches = haystack.match(SOL_BASE58) ?? []
  for (const mint of solMatches) {
    if (!isLikelySolanaMint(mint)) continue
    return {
      chain: 'solana',
      contractAddress: mint,
      tokenSymbol: extractTicker(text),
      price: extractPrice(text),
      signalType: inferSignalType(text),
      confidence: 0.75,
      parseMethod: 'regex',
    }
  }

  const ticker = extractTicker(text)
  if (ticker !== 'TOKEN' && (BUY_RE.test(text) || SELL_RE.test(text))) {
    return null
  }

  return null
}
