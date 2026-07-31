import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.next') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

describe('infrastructure — vendor isolation', () => {
  it('has zero forbidden host references outside lockfiles', () => {
    const root = join(__dirname, '../..')
    const files = walk(root).filter(
      (f) =>
        !f.includes('package-lock.json') &&
        !f.includes('no-railway.test.ts') &&
        !f.endsWith('.png') &&
        !f.endsWith('.jpg') &&
        !f.endsWith('.webp') &&
        !f.endsWith('.mp4'),
    )
    const hits: string[] = []
    const needle = ['R', 'a', 'i', 'l', 'w', 'a', 'y'].join('')
    const re = new RegExp(needle, 'i')
    for (const f of files) {
      let text = ''
      try {
        text = readFileSync(f, 'utf8')
      } catch {
        continue
      }
      if (re.test(text)) hits.push(f.replace(root + '/', ''))
    }
    assert.deepEqual(hits, [], `Forbidden host references remain:\n${hits.join('\n')}`)
  })
})
