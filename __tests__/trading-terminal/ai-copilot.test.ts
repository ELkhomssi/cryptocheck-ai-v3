import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resetDemoSeedCache } from '../../lib/trading-terminal/data/demo-seed'
import {
  appendToSession,
  buildCopilotDesk,
  createCopilotSession,
  detectCopilotMode,
  runCopilotPrompt,
} from '../../lib/trading-terminal/ai-copilot'

describe('buildCopilotDesk', () => {
  it('demo desk primes a SAMPLE session with online demo_seed source', () => {
    resetDemoSeedCache()
    const desk = buildCopilotDesk('demo')
    assert.equal(desk.mode, 'demo')
    assert.equal(desk.sample, true)
    assert.ok(desk.sessions.length >= 1)
    assert.ok(desk.sessions[0]!.responses.length >= 1)
    assert.ok(desk.sessions[0]!.responses[0]!.sample)
    assert.ok(desk.sessions[0]!.responses[0]!.sourcesUsed.includes('demo_seed'))
    const demoSrc = desk.sources.find((s) => s.id === 'demo_seed')
    assert.equal(demoSrc?.status, 'ONLINE')
    assert.ok(desk.starterPrompts.length >= 5)
  })

  it('live desk returns INSUFFICIENT DATA and offline sources', () => {
    const desk = buildCopilotDesk('live')
    assert.equal(desk.sample, false)
    assert.ok(desk.sources.every((s) => s.status === 'OFFLINE'))
    const resp = runCopilotPrompt({
      prompt: 'Analyze BONK',
      dataMode: 'live',
      priorMode: null,
      contextSymbol: null,
    })
    assert.equal(resp.insufficientData, true)
    assert.match(resp.summary, /INSUFFICIENT DATA/)
    assert.equal(resp.confidence, null)
    assert.equal(resp.sourcesUsed.length, 0)
    assert.equal(resp.sample, false)
  })
})

describe('runCopilotPrompt modes', () => {
  it('routes token / portfolio / whale / alpha / report and keeps follow-up context', () => {
    resetDemoSeedCache()
    assert.equal(detectCopilotMode('Analyze SOLCAT', null), 'token')
    assert.equal(detectCopilotMode('Analyze my portfolio', null), 'portfolio')
    assert.equal(detectCopilotMode('Show smart money accumulation today', null), 'whale')
    assert.equal(detectCopilotMode('Find early accumulation tokens', null), 'alpha')
    assert.equal(detectCopilotMode('Generate research report on SOLCAT', null), 'report')

    const token = runCopilotPrompt({
      prompt: 'Analyze SOLCAT',
      dataMode: 'demo',
      priorMode: null,
      contextSymbol: null,
    })
    assert.equal(token.mode, 'token')
    assert.ok(token.tokenMetrics)
    assert.ok(token.keyFindings.length > 0)
    assert.ok(token.riskFactors.length > 0)
    assert.ok(token.opportunities.length > 0)
    assert.ok(token.confidence != null && token.confidence > 0)

    const report = runCopilotPrompt({
      prompt: 'Generate research report on SOLCAT',
      dataMode: 'demo',
      priorMode: 'token',
      contextSymbol: 'SOLCAT',
    })
    assert.equal(report.mode, 'report')
    assert.ok(report.reportSections && report.reportSections.length >= 6)

    let sess = createCopilotSession(true)
    sess = appendToSession(sess, token)
    const follow = runCopilotPrompt({
      prompt: 'Show whale activity',
      dataMode: 'demo',
      priorMode: sess.contextMode,
      contextSymbol: sess.contextSymbol,
    })
    assert.equal(follow.mode, 'whale')
    assert.equal(sess.contextSymbol, 'SOLCAT')
  })
})
