/**
 * AI Gateway presentation — reuses Decision schema fields only.
 * Run: node --import tsx --test __tests__/ai-os/gateway-presentation.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('AI Gateway presentation integrity', () => {
  it('IntelligenceSwap still uses real Decision + ExecutionState + risk-gated path', () => {
    const src = readFileSync(join(root, 'features/ai-os/components/IntelligenceSwap.tsx'), 'utf8')
    assert.match(src, /@cryptocheck\/decision-contracts/)
    assert.match(src, /ExecutionState/)
    assert.match(src, /\/api\/revenue\/quote/)
    assert.match(src, /\/api\/revenue\/assess-swap/)
    assert.match(src, /signTransaction/)
    assert.match(src, /Estimated total cost/)
    assert.match(src, /DANGER_ACK_PHRASE|OVERRIDE_PHRASE/)
    // Presentation surfaces full Decision schema
    assert.match(src, /decision\.action/)
    assert.match(src, /decision\.reasoning/)
    assert.match(src, /marketConfidence/)
    assert.match(src, /personalizedConfidence/)
    assert.match(src, /expectedROI/)
    assert.match(src, /contributingFactors/)
    // Must not invent placeholder scores
    assert.doesNotMatch(src, /confidence:\s*85/)
    assert.doesNotMatch(src, /sample-decision/)
  })

  it('TerminalOsShell mounts IntelligenceSwap as AI Gateway centerpiece', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    assert.match(shell, /IntelligenceSwap/)
    assert.match(shell, /AI Gateway/)
    assert.match(shell, /AiGatewayCenterpiece/)
    // Foundation intact — still TerminalOsShell, not AiOsShell as page root
    const page = readFileSync(join(root, 'app/terminalOS/page.tsx'), 'utf8')
    const pageCode = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.match(pageCode, /TerminalOsShell/)
    assert.doesNotMatch(pageCode, /AiOsShell/)
  })

  it('executeSwap body not rewritten with placeholders', () => {
    const src = readFileSync(join(root, 'features/ai-os/components/IntelligenceSwap.tsx'), 'utf8')
    assert.match(src, /buildJupiterSwapTransaction|\/api\/execution\/prepare/)
    assert.match(src, /simulateSerializedSwapTransaction/)
    assert.match(src, /sendSignedSwap/)
  })
})
