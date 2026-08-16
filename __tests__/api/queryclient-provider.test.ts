import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const root = join(__dirname, '../..')

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('QueryClient provider hierarchy', () => {
  it('root layout mounts a single AppProviders QueryClientProvider', () => {
    const layout = read('app/layout.tsx')
    const providers = read('app/providers.tsx')
    assert.match(layout, /AppProviders/)
    assert.match(providers, /QueryClientProvider/)
    assert.match(providers, /new QueryClient\(/)
    assert.equal((providers.match(/new QueryClient\(/g) ?? []).length, 1)
  })

  it('nested Portfolio / Terminal OS providers do not create a second QueryClient', () => {
    const portfolio = read('components/portfolio-desk/Providers.tsx')
    const terminalOs = read('features/terminal-os/shell/Providers.tsx')
    assert.doesNotMatch(portfolio, /new QueryClient|QueryClientProvider/)
    assert.doesNotMatch(terminalOs, /new QueryClient|QueryClientProvider/)
  })

  it('key client routes remain under the root layout tree', () => {
    for (const rel of [
      'app/app/page.tsx',
      'app/dashboard/layout.tsx',
      'app/terminalOS/layout.tsx',
      'app/terminal/layout.tsx',
    ]) {
      assert.ok(read(rel).length > 0, `missing ${rel}`)
    }
  })
})
