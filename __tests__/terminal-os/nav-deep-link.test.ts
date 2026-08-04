/**
 * Nav deep-link resolver for /terminalOS?nav=
 * Run: node --import tsx --test __tests__/terminal-os/nav-deep-link.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTerminalOsNavParam } from '../../features/terminal-os/shell/lib/nav-deep-link'

describe('resolveTerminalOsNavParam', () => {
  it('maps legacy desk nav ids', () => {
    assert.equal(resolveTerminalOsNavParam('mission'), 'mission-control')
    assert.equal(resolveTerminalOsNavParam('coach'), 'ai-coach')
    assert.equal(resolveTerminalOsNavParam('market'), 'market-intel')
    assert.equal(resolveTerminalOsNavParam('trade'), 'execution')
    assert.equal(resolveTerminalOsNavParam('feed'), 'alerts')
  })

  it('passes through Terminal OS nav ids', () => {
    assert.equal(resolveTerminalOsNavParam('mission-control'), 'mission-control')
    assert.equal(resolveTerminalOsNavParam('ai-coach'), 'ai-coach')
    assert.equal(resolveTerminalOsNavParam('scout'), 'scout')
  })

  it('returns null for empty / unknown', () => {
    assert.equal(resolveTerminalOsNavParam(null), null)
    assert.equal(resolveTerminalOsNavParam(''), null)
    assert.equal(resolveTerminalOsNavParam('not-a-nav'), null)
  })
})
