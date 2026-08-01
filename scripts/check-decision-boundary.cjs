#!/usr/bin/env node
/**
 * ONE DECISION — Layer 4 may not import Layer 1 engines directly.
 * Layer 4 may only consume Decision via decision-contracts, decide-for-token,
 * to-canonical-decision, decision-engine, explainable-engine, or orchestrator hooks.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const LAYER4_DIRS = [
  'features/intelligence-chart',
  'features/terminal-os/ai-coach',
  'features/terminal-os/money-lifecycle',
  'features/execution-desk',
  'features/terminal-os/alerts',
  'features/terminal-os/discovery-engine',
  'features/attention-feed',
]

/** Layer 1 engine modules — facts/signals; Layer 4 must not import these */
const BANNED = [
  /from\s+['"][^'"]*engines\/market-intelligence-engine['"]/,
  /from\s+['"][^'"]*engines\/prediction-engine['"]/,
  /from\s+['"][^'"]*engines\/behavioral-learning-engine['"]/,
  /from\s+['"][^'"]*engines\/trader-dna-engine['"]/,
  /from\s+['"][^'"]*engines\/collective-intelligence-engine['"]/,
  /from\s+['"][^'"]*lib\/score-from-market['"]/,
  /from\s+['"][^'"]*shared\/lib\/enrich-whale-movement['"]/,
]

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, ent.name)
    if (ent.isDirectory()) walk(path.relative(ROOT, p), out)
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p)
  }
  return out
}

const violations = []
for (const dir of LAYER4_DIRS) {
  for (const file of walk(dir)) {
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      for (const re of BANNED) {
        if (re.test(line)) {
          violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${trimmed}`)
        }
      }
    })
  }
}

if (violations.length) {
  console.error('lint:decision-boundary FAILED — Layer 4 imported Layer 1 engines:\n')
  for (const v of violations) console.error('  ' + v)
  console.error('\nLayer 4 may only read Decision via @cryptocheck/decision-contracts,')
  console.error('decide-for-token, to-canonical-decision, decision-engine, or orchestrator hooks.')
  process.exit(1)
}

console.log('lint:decision-boundary OK (0 violations)')
