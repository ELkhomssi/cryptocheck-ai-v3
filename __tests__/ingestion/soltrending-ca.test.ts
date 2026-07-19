import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectUrls,
  extractCaFromUrl,
  parseWithRegex,
} from '../../services/ingestion/src/parser/regex-parser.ts'
import type { RawMessage } from '@cryptocheck/signal-contracts'

function msg(partial: Partial<RawMessage>): RawMessage {
  return {
    channel: '@SOLTRENDING',
    messageId: '1',
    text: '',
    entities: [],
    eventType: 'new',
    ts: new Date().toISOString(),
    ingestTs: new Date().toISOString(),
    ...partial,
  }
}

const SAMPLE_MINT = 'So11111111111111111111111111111111111111112'

describe('SOLTRENDING DexT / Screener CA extraction', () => {
  it('extracts CA from dexscreener (Screener) URL', () => {
    const hit = extractCaFromUrl(`https://dexscreener.com/solana/${SAMPLE_MINT}`)
    assert.equal(hit?.ca, SAMPLE_MINT)
    assert.equal(hit?.chain, 'solana')
  })

  it('extracts CA from dextools (DexT) pair-explorer URL', () => {
    const hit = extractCaFromUrl(
      `https://www.dextools.io/app/en/solana/pair-explorer/${SAMPLE_MINT}`,
    )
    assert.equal(hit?.ca, SAMPLE_MINT)
  })

  it('reads TextUrl entities (DexT / Screener buttons)', () => {
    const raw = msg({
      text: '$PEPE new call DexT Screener',
      entities: [
        { className: 'MessageEntityTextUrl', offset: 15, length: 4, url: `https://www.dextools.io/app/en/solana/pair-explorer/${SAMPLE_MINT}` },
        { className: 'MessageEntityTextUrl', offset: 20, length: 8, url: `https://dexscreener.com/solana/${SAMPLE_MINT}` },
      ],
    })
    const urls = collectUrls(raw)
    assert.ok(urls.some((u) => u.includes('dextools')))
    const parsed = parseWithRegex(raw)
    assert.ok(parsed)
    assert.equal(parsed!.contractAddress, SAMPLE_MINT)
    assert.equal(parsed!.confidence >= 0.95, true)
  })

  it('reads MessageEntityUrl span from text', () => {
    const url = `https://dexscreener.com/solana/${SAMPLE_MINT}`
    const raw = msg({
      text: url,
      entities: [{ className: 'MessageEntityUrl', offset: 0, length: url.length }],
    })
    const parsed = parseWithRegex(raw)
    assert.equal(parsed?.contractAddress, SAMPLE_MINT)
  })

  it('rejects hex-only blobs as Solana mints (whale_alert false positives)', () => {
    const hexBlob = 'a4fa214af48c9e93542976863e6d8ca56c41aca5793abcd'
    const raw = msg({
      channel: '@whale_alert_io',
      text: `1000 BTC moved ${hexBlob}`,
    })
    const parsed = parseWithRegex(raw)
    assert.equal(parsed?.chain === 'solana', false)
  })
})
