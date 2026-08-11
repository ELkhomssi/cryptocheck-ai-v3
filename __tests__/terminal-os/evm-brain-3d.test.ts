/**
 * EVM holdings + ChainDataPort + Brain 3D hologram wiring.
 * Run: node --import tsx --test __tests__/terminal-os/evm-brain-3d.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('EVM holdings + ChainDataPort', () => {
  it('evm-holdings-service validates 0x and prices via DexScreener/CoinGecko (no new HTTP lib)', () => {
    const svc = readFileSync(join(root, 'lib/portfolio-desk/evm-holdings-service.ts'), 'utf8')
    assert.match(svc, /isValidEvmWallet/)
    assert.match(svc, /buildEvmHoldingsResponse/)
    assert.match(svc, /api\.dexscreener\.com/)
    assert.match(svc, /api\.coingecko\.com/)
    assert.match(svc, /ethplorer\.io/)
    assert.match(svc, /eth_getBalance/)
    assert.doesNotMatch(svc, /from 'axios'|from \"axios\"|ethers\.|viem/)
  })

  it('ChainDataPort registers EvmChainPort for ethereum/base/bnb/arbitrum', () => {
    const port = readFileSync(join(root, 'lib/connect/chain-port.ts'), 'utf8')
    assert.match(port, /export class EvmChainPort/)
    assert.match(port, /new EvmChainPort\('ethereum'\)/)
    assert.match(port, /new EvmChainPort\('base'\)/)
    assert.match(port, /DexScreener market enrichment/)
    assert.match(port, /Security Scanner risk scores remain Solana-path/)
  })

  it('holdings API routes EVM wallets; portfolio UI unblocks EVM; swap stays Solana', () => {
    const route = readFileSync(join(root, 'app/api/portfolio/holdings/route.ts'), 'utf8')
    const panel = readFileSync(
      join(root, 'features/terminal-os/portfolio-os/components/PortfolioOverviewPanel.tsx'),
      'utf8',
    )
    const top = readFileSync(join(root, 'features/terminal-os/shell/components/TopBar.tsx'), 'utf8')
    const swap = readFileSync(
      join(root, 'features/terminal-os/trading-workspace/components/QuickSwapCard.tsx'),
      'utf8',
    )
    assert.match(route, /buildEvmHoldingsResponse/)
    assert.match(route, /isValidEvmWallet/)
    assert.doesNotMatch(panel, /Portfolio health uses Solana holdings today/)
    assert.match(panel, /chainFamily === 'evm'/)
    assert.match(top, /chain', 'ethereum'/)
    assert.match(swap, /EVM holdings are live/)
    assert.match(swap, /Jupiter/)
  })
})

describe('Brain 3D hologram', () => {
  it('DecisionBrainSpokes always renders hologram depth (even while waiting)', () => {
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/HomeDeskPanels.tsx'),
      'utf8',
    )
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    assert.match(panels, /tos-brain-orbit--holo/)
    assert.match(panels, /data-tos-brain-3d/)
    assert.match(panels, /tosBrainGlow/)
    assert.match(panels, /waiting \? BRAIN_SIGNAL_SLOTS/)
    assert.match(panels, /Hologram online/)
    assert.match(css, /tos-brain-svg--3d/)
    assert.match(css, /tos-brain-orbit--holo\.tos-brain-orbit--empty/)
    assert.doesNotMatch(panels, /Market Sentiment \(92%\)/)
    assert.doesNotMatch(panels, /37,?584/)
  })
})
