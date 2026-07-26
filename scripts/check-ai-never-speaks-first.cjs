#!/usr/bin/env node
/**
 * Phase 16.7 — "AI never speaks first" copy lint.
 * Fails if user-facing strings use employee-name-prefixed phrasing.
 *
 * Patterns blocked (case-insensitive):
 *   "<EmployeeName> says|said|thinks|found|reports|detected|flags|notes"
 *   "Whale Hunter says", "Research Agent found", etc.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const SCAN_DIRS = [
  'components/portfolio-desk',
  'lib/intelligence',
  'lib/agents',
  'app/api/agents',
  'app/api/intelligence',
]

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mdx'])

/** Built-in + Phase 16 ideal names that must not speak first. */
const NAMES = [
  'Whale Hunter',
  'Whale Analyst',
  'Smart Money Tracker',
  'Liquidity Engineer',
  'DEX Flow Analyst',
  'Meme Hunter',
  'Scam Investigator',
  'On-chain Detective',
  'Wallet Profiler',
  'Bridge Monitor',
  'Trading Coach',
  'Execution Agent',
  'Arbitrage Hunter',
  'Market Maker Observer',
  'Portfolio Manager',
  'Risk Manager',
  'Strategy Builder',
  'Yield Hunter',
  'Launch Advisor',
  'Research Analyst',
  'Research Agent',
  'Macro Economist',
  'News Intelligence',
  'Social Intelligence',
  'Market Strategist',
  'Developer Assistant',
  'Prompt Engineer',
]

const VERBS = 'says|said|thinks|found|reports|detected|flags|notes|believes|concludes|warns'

const NAME_ALT = NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
const PATTERN = new RegExp(`\\b(?:${NAME_ALT})\\s+(?:${VERBS})\\b`, 'i')

// Also catch generic "<Something> Agent says"
const GENERIC = /\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?\s+Agent\s+(?:says|said|thinks|found)\b/

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (EXT.has(path.extname(ent.name))) out.push(p)
  }
  return out
}

const violations = []

for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir)
  for (const file of walk(abs)) {
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, i) => {
      // Allow mentions inside this lint script's own comments / docs about the ban.
      if (line.includes('Never write') || line.includes('Never prefix') || line.includes('no "'))
        return
      if (line.includes('AI never speaks') || line.includes('employee-name-prefixed')) return
      if (PATTERN.test(line) || GENERIC.test(line)) {
        violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
      }
    })
  }
}

if (violations.length) {
  console.error('AI-never-speaks-first lint FAILED:\n')
  for (const v of violations) console.error('  ' + v)
  process.exit(1)
}

console.log('AI-never-speaks-first lint OK (0 violations)')
