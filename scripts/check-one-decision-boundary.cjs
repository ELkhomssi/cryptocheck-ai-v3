#!/usr/bin/env node
/**
 * One-Decision kernel boundary — Layer 4 presentation surfaces must not
 * import Decision Engine internals (decide / buildMarketIntel / scoreTokenFromMarket).
 * They read published Decisions via API / decision-store consumers only.
 *
 * Run: npm run lint:one-decision
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

/** Layer 4 UI component trees (presentation only). */
const LAYER4_DIRS = [
  'features/terminal-os/discovery-engine/components',
  'features/terminal-os/ai-coach/components',
  'features/terminal-os/security-center/components',
  'features/terminal-os/shell/components',
  'features/ai-os/components',
  'features/execution-desk/components',
  'features/attention-feed/components',
  'features/intelligence-chart/components',
]

const BANNED = [
  {
    re: /from\s+['"][^'"]*\/decision-engine['"]/,
    why: 'direct Decision Engine import — use published Decision via API',
  },
  {
    re: /from\s+['"][^'"]*\/market-intelligence-engine['"]/,
    why: 'buildMarketIntel / Market Intelligence internals — route through Decision',
  },
  {
    re: /\bdecide\s*\(/,
    why: 'local decide() — Layer 4 must not compute a second opinion',
  },
  {
    re: /\bbuildMarketIntel\s*\(/,
    why: 'local buildMarketIntel() — Layer 4 must not recompute market intel',
  },
  {
    re: /from\s+['"][^'"]*\/score-from-market['"].*\n|scoreTokenFromMarket/,
    why: 'local scoreTokenFromMarket — Discovery must read published Decision only',
    onlyUnder: 'features/terminal-os/discovery-engine/components',
  },
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p)
  }
  return out
}

const violations = []
for (const rel of LAYER4_DIRS) {
  for (const file of walk(path.join(ROOT, rel))) {
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, i) => {
      const trimmed = line.trimStart()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return
      }
      for (const ban of BANNED) {
        if (ban.onlyUnder && !rel.startsWith(ban.onlyUnder) && !file.includes(ban.onlyUnder)) {
          continue
        }
        if (ban.re.test(line)) {
          violations.push(
            `${path.relative(ROOT, file)}:${i + 1}: ${ban.why}\n    ${line.trim()}`,
          )
        }
      }
    })
  }
}

if (violations.length) {
  console.error('lint:one-decision FAILED — Layer 4 imported Decision Engine internals:\n')
  for (const v of violations) console.error('  ' + v + '\n')
  process.exit(1)
}

console.log('lint:one-decision OK (0 violations across Layer 4 component trees)')
