#!/usr/bin/env node
/**
 * Phase 12.2 — Design token enforcement.
 * Fails if hex / rgb(a) / non-neutral Tailwind color utilities appear outside
 * styles/tokens.css in the locked terminal surfaces.
 *
 * Usage: node scripts/check-design-tokens.mjs
 *        npm run lint:tokens
 *
 * Scoped paths (hard gate for terminal):
 *   components/portfolio-desk/**
 *   app/terminal/**
 *   app/ai-employees/**
 *   lib/portfolio-desk/**
 *
 * Full-repo legacy surfaces (dashboard.tsx, landing, etc.) still carry
 * hardcoded colors — tracked separately. Do not expand scope until those
 * migrate; inventing new tokens requires an explicit ask (Phase 12.1).
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const ALLOWED_FILES = new Set([
  path.join(ROOT, 'styles/tokens.css'),
])

const SCOPES = [
  'components/portfolio-desk',
  'app/terminal',
  'app/ai-employees',
  'lib/portfolio-desk',
]

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.mjs', '.cjs'])

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const RGB_RE = /\brgba?\(/g
const TW_COLOR_RE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|accent|caret|divide|shadow)-(?:amber|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|blue|green)-\S+/g

/** Allow CSS var() references and comments mentioning hex in docs. */
function stripNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (EXT.has(path.extname(ent.name))) out.push(full)
  }
  return out
}

const findings = []

for (const scope of SCOPES) {
  const files = walk(path.join(ROOT, scope))
  for (const file of files) {
    if (ALLOWED_FILES.has(file)) continue
    // theme.css may only import tokens — still scan for leftover hex
    const raw = fs.readFileSync(file, 'utf8')
    const src = stripNoise(raw)
    const rel = path.relative(ROOT, file)

    for (const m of src.matchAll(HEX_RE)) {
      // Allow pure black/white only if somehow left — still fail; tokens.css is sole allowlist
      findings.push({ file: rel, kind: 'hex', match: m[0] })
    }
    for (const m of src.matchAll(RGB_RE)) {
      findings.push({ file: rel, kind: 'rgb', match: m[0] })
    }
    for (const m of src.matchAll(TW_COLOR_RE)) {
      findings.push({ file: rel, kind: 'tailwind-color', match: m[0] })
    }
  }
}

if (findings.length) {
  console.error(`lint:tokens FAILED — ${findings.length} violation(s) outside styles/tokens.css:\n`)
  for (const f of findings.slice(0, 80)) {
    console.error(`  ${f.file}: [${f.kind}] ${f.match}`)
  }
  if (findings.length > 80) console.error(`  … +${findings.length - 80} more`)
  console.error('\nFix: replace with var(--bg|--accent|--positive|…) from styles/tokens.css')
  process.exit(1)
}

console.log('lint:tokens OK — no hardcoded colors in terminal scopes.')
process.exit(0)
