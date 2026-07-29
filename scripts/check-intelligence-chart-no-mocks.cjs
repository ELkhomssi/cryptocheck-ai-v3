#!/usr/bin/env node
/**
 * Phase 22 — Intelligence Chart must never import mock/fixture data paths.
 * Fails the build if any file under features/intelligence-chart imports mocks.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DIR = path.join(ROOT, 'features/intelligence-chart')

const BANNED = [
  /from\s+['"][^'"]*mock[^'"]*['"]/i,
  /from\s+['"][^'"]*fixture[^'"]*['"]/i,
  /from\s+['"]@\/features\/terminal-os\/shared\/lib\/mock-data['"]/,
  /from\s+['"]@\/features\/terminal-os\/shared\/lib\/mock-providers['"]/,
  /from\s+['"]@\/lib\/terminal-os\/demo-dataset['"]/,
  /MOCK_/,
  /sample:\s*true/,
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx)$/.test(ent.name)) out.push(p)
  }
  return out
}

const violations = []
for (const file of walk(DIR)) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    for (const re of BANNED) {
      if (re.test(line)) {
        // Allow comments explaining the rule
        if (line.includes('must never') || line.includes('never import')) return
        violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${trimmed}`)
      }
    }
  })
}

if (violations.length) {
  console.error('lint:intelligence-chart FAILED — mock/fixture import banned:\n')
  for (const v of violations) console.error('  ' + v)
  process.exit(1)
}

console.log('lint:intelligence-chart OK (0 violations)')
