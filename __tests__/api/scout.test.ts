import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Scout API routes', () => {
  it('exposes run/status/approve/cron handlers with auth gates', () => {
    const run = readFileSync(join(process.cwd(), 'app/api/scout/run/route.ts'), 'utf8')
    const status = readFileSync(join(process.cwd(), 'app/api/scout/status/route.ts'), 'utf8')
    const approve = readFileSync(join(process.cwd(), 'app/api/scout/approve/route.ts'), 'utf8')
    const cron = readFileSync(join(process.cwd(), 'app/api/cron/scout-cycle/route.ts'), 'utf8')
    assert.match(run, /runScoutCycle/)
    assert.match(run, /isOperatorUser|SCOUT_RUN_SECRET|CRON_SECRET/)
    assert.match(status, /loadScoutState/)
    assert.match(approve, /approveScoutArticle/)
    assert.match(cron, /CRON_SECRET/)
    assert.match(cron, /version: 'v2'|autoPublish/)
  })

  it('registers Terminal OS scout nav and blog routes', () => {
    const types = readFileSync(join(process.cwd(), 'features/terminal-os/shared/types/index.ts'), 'utf8')
    const rail = readFileSync(join(process.cwd(), 'features/terminal-os/shell/components/LeftRail.tsx'), 'utf8')
    const shell = readFileSync(join(process.cwd(), 'features/terminal-os/shell/components/TerminalOsShell.tsx'), 'utf8')
    assert.match(types, /'scout'/)
    assert.match(rail, /id: 'scout'/)
    assert.match(shell, /ScoutPanel/)
    readFileSync(join(process.cwd(), 'app/blog/page.tsx'), 'utf8')
    readFileSync(join(process.cwd(), 'app/blog/[slug]/page.tsx'), 'utf8')
  })
})
