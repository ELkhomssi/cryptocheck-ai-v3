#!/usr/bin/env node
/**
 * Design token enforcement (Phase 12 + Polish sprint).
 * Fails if hex / rgb(a) / non-neutral Tailwind color utilities appear outside
 * allowlisted token sources in locked surfaces.
 *
 * Also flags raw px box-shadow and off-scale spacing literals in Priority 1 UI.
 *
 * Usage: npm run lint:tokens
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

/** Files allowed to define raw palette / elevation hex */
const ALLOWED_FILES = new Set([
  path.join(ROOT, 'styles/tokens.css'),
  path.join(ROOT, 'styles/terminal-os.css'),
  path.join(ROOT, 'features/intelligence-chart/visual-tokens.ts'),
  path.join(ROOT, 'features/intelligence-chart/styles.css'),
])

const COLOR_SCOPES = [
  'components/portfolio-desk',
  'app/terminal',
  'app/ai-employees',
  'lib/portfolio-desk',
  'features/execution-desk',
  'features/terminal-os/shell',
  'features/terminal-os/shared',
]

/** Priority 1 presentation — no raw px shadows / prefer token spacing */
const POLISH_SCOPES = [
  'features/execution-desk',
  'features/terminal-os/shell',
  'features/terminal-os/shared',
  'app/terminalOS',
]

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.mjs', '.cjs'])

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const RGB_RE = /\brgba?\(/g
const TW_COLOR_RE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|decoration|accent|caret|divide|shadow)-(?:amber|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|blue|green)-\S+/g

/** box-shadow with raw px blur not using var( */
const RAW_SHADOW_RE = /box-shadow\s*:[^;{]*\d+px[^;{]*;/gi
/** style={{ padding: 12 }} / gap: 8 style numbers (common drift) */
const STYLE_SPACE_RE =
  /(?:padding|margin|gap|borderRadius)\s*:\s*(?:['"`])?\d{1,3}(?:px)?(?:['"`])?(?!\s*\*)/g

const CANON_SPACE_PX = new Set([4, 8, 12, 16, 24, 32, 48])

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

for (const scope of COLOR_SCOPES) {
  const files = walk(path.join(ROOT, scope))
  for (const file of files) {
    if (ALLOWED_FILES.has(file)) continue
    const src = stripNoise(fs.readFileSync(file, 'utf8'))
    const rel = path.relative(ROOT, file)

    for (const m of src.matchAll(HEX_RE)) {
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

for (const scope of POLISH_SCOPES) {
  const files = walk(path.join(ROOT, scope))
  for (const file of files) {
    if (ALLOWED_FILES.has(file)) continue
    // CSS token files under execution-desk should use vars — scan them
    const raw = fs.readFileSync(file, 'utf8')
    const src = stripNoise(raw)
    const rel = path.relative(ROOT, file)

    if (rel.endsWith('.css')) {
      for (const m of src.matchAll(RAW_SHADOW_RE)) {
        if (m[0].includes('var(')) continue
        findings.push({ file: rel, kind: 'raw-shadow-px', match: m[0].trim().slice(0, 80) })
      }
    }

    // Flag unitless spacing in style objects that aren't on the 4/8/12/16/24/32/48 scale
    for (const m of src.matchAll(
      /(?:padding|margin|gap|borderRadius)\s*:\s*(\d{1,3})(?!\s*(?:\*|px|rem|em|%|var))/g,
    )) {
      const n = Number(m[1])
      if (!CANON_SPACE_PX.has(n) && n > 1) {
        findings.push({ file: rel, kind: 'off-scale-spacing', match: m[0] })
      }
    }
  }
}

if (findings.length) {
  console.error(`lint:tokens FAILED — ${findings.length} violation(s):\n`)
  for (const f of findings.slice(0, 100)) {
    console.error(`  ${f.file}: [${f.kind}] ${f.match}`)
  }
  if (findings.length > 100) console.error(`  … +${findings.length - 100} more`)
  console.error(
    '\nFix: use var(--space-*|--tos-*|--motion-*) from styles/tokens.css + styles/terminal-os.css',
  )
  process.exit(1)
}

console.log('lint:tokens OK — Priority 1 scopes clean (colors + spacing/shadow drift).')
process.exit(0)
