#!/usr/bin/env node
/**
 * Intelligence Visualization — forbid vendor chart residue + mock imports.
 * Fails if lightweight-charts / TradingView strings re-enter, or if
 * features/intelligence-chart imports mock/fixture paths.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const DIR = path.join(ROOT, 'features/intelligence-chart')

const FORBIDDEN = [
  'lightweight-charts',
  'TradingView',
  'tv-attr-logo',
  'tv-logo',
  'Charting by TradingView',
]

const MOCK_BANNED = [
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
    else if (/\.(ts|tsx|js|jsx|css|md|cjs|mjs|json)$/.test(ent.name)) out.push(p)
  }
  return out
}

const violations = []

let hasRg = false
try {
  execSync('rg --version', { stdio: 'ignore' })
  hasRg = true
} catch {
  // Vercel / minimal CI images often lack ripgrep — package.json checks still run
  console.warn('lint:intelligence-chart: rg not found; skipping repo-wide vendor string scan')
}

if (hasRg) {
  for (const needle of FORBIDDEN) {
    try {
      const out = execSync(
        `rg -n --glob '!node_modules/**' --glob '!package-lock.json' --glob '!.git/**' ${JSON.stringify(needle)} .`,
        { cwd: ROOT, encoding: 'utf8' },
      ).trim()
      if (out) {
        for (const line of out.split('\n')) {
          if (!line) continue
          if (line.includes('check-intelligence-chart')) continue
          if (line.includes('FORBIDDEN')) continue
          violations.push(`vendor:${line}`)
        }
      }
    } catch (e) {
      // rg exit 1 = no matches
      if (e.status !== 1) throw e
    }
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const deps = { ...pkg.dependencies, ...pkg.devDependencies }
if (deps['lightweight-charts']) {
  violations.push('package.json lists lightweight-charts dependency')
}
if (!deps.echarts) {
  violations.push('package.json missing echarts dependency')
}

for (const file of walk(DIR)) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    for (const re of MOCK_BANNED) {
      if (re.test(line)) {
        if (line.includes('must never') || line.includes('never import')) return
        violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${trimmed}`)
      }
    }
  })
}

if (violations.length) {
  console.error('lint:intelligence-chart FAILED:\n')
  for (const v of violations) console.error('  ' + v)
  process.exit(1)
}

console.log('lint:intelligence-chart OK (vendor-clean + no mock imports)')
