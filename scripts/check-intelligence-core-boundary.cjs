#!/usr/bin/env node
/**
 * Phase 17.9 — Intelligence Core safety boundary.
 * Fails if lib/intelligence-core imports trade-execution, wallet-signing,
 * launch-deployment, or automation-scheduling write paths.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DIR = path.join(ROOT, 'lib/intelligence-core')

const BANNED = [
  /from\s+['"]@\/lib\/trading\/risk-gated-swap['"]/,
  /from\s+['"]@\/lib\/trading\/jupiter-client['"]/,
  /from\s+['"]@\/lib\/launchpad\/[^'"]*deploy[^'"]*['"]/,
  /from\s+['"]@\/lib\/launchpad\/create[^'"]*['"]/,
  /from\s+['"]@\/programs\//,
  /PLATFORM_FEE_AUTHORITY_SECRET/,
  /signTransaction|signAndSend|Keypair\.fromSecret/,
  /from\s+['"]@\/app\/api\/cron\/terminal-orders['"]/,
  /scheduleAutomation|armSniper|createCron/,
]

const ALLOWED_README = 'README.md'

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx)$/.test(ent.name) && ent.name !== ALLOWED_README) out.push(p)
  }
  return out
}

const violations = []
for (const file of walk(DIR)) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) {
      // Still ban real imports even in comments that look like code? Allow docs.
      if (!line.includes('import ') && !line.includes('from ')) return
    }
    for (const re of BANNED) {
      if (re.test(line) && !line.includes('must NOT') && !line.includes('may not')) {
        violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
      }
    }
  })
}

if (violations.length) {
  console.error('lint:intelligence-core FAILED — safety boundary violated:\n')
  for (const v of violations) console.error('  ' + v)
  process.exit(1)
}

console.log('lint:intelligence-core OK (0 violations)')
