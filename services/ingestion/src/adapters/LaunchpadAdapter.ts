/**
 * LaunchpadScout — Helius firehose of new pump.fun / Raydium LaunchLab / pool mints.
 * Pre-filters before emit so the gate / Neural V4 load stays bounded.
 *
 * Modes:
 * - Webhook-driven: Next.js `/api/webhooks/helius-launchpad` XADDs; this adapter
 *   can also poll Helius enhanced txs when LAUNCHPAD_POLL=true.
 */
import {
  namespacedSignalId,
  type SourceAdapter,
  type UnifiedSignal,
} from '@cryptocheck/signal-contracts'
import type { UnifiedStreamWriter } from '../unified-stream.js'

export type LaunchpadAdapterConfig = {
  heliusApiKey: string
  pollMs: number
  minLiquidityUsd: number
  minAgeSec: number
  enabled: boolean
}

const DEDUP = new Set<string>()
const DEDUP_MAX = 5_000

function remember(mint: string): boolean {
  if (DEDUP.has(mint)) return false
  DEDUP.add(mint)
  if (DEDUP.size > DEDUP_MAX) {
    const first = DEDUP.values().next().value
    if (first) DEDUP.delete(first)
  }
  return true
}

export function mintPassesPrefilter(
  mint: string,
  meta: { liquidityUsd?: number; ageSec?: number },
  cfg: { minLiquidityUsd: number; minAgeSec: number },
): boolean {
  if (!mint || mint.length < 32) return false
  if (!remember(mint)) return false
  if (meta.liquidityUsd != null && meta.liquidityUsd < cfg.minLiquidityUsd) return false
  if (meta.ageSec != null && meta.ageSec < cfg.minAgeSec) return false
  return true
}

export function buildLaunchpadSignal(input: {
  mint: string
  symbol?: string
  label?: string
  liquidityUsd?: number
  sourceRef?: string
}): UnifiedSignal {
  const now = new Date().toISOString()
  const sourceRef = input.sourceRef ?? `mint:${input.mint}`
  return {
    id: namespacedSignalId('launchpad', sourceRef),
    sourceTag: 'launchpad',
    sourceRef,
    subjectType: 'token',
    label: input.label ?? input.symbol ?? input.mint.slice(0, 6),
    type: 'mention',
    msgTimestamp: now,
    ingestTimestamp: now,
    confidence: 0.7,
    chain: 'solana',
    contractAddress: input.mint,
    tokenSymbol: input.symbol,
    verdict: 'scanning',
    rawPayload: {
      liquidity: input.liquidityUsd,
      firehose: true,
      platform: 'helius',
    },
    sources: ['launchpad', 'helius'],
    sourceCount: 2,
  }
}

export class LaunchpadAdapter implements SourceAdapter {
  readonly sourceTag = 'launchpad' as const
  private timer: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(
    private readonly cfg: LaunchpadAdapterConfig,
    private readonly writer: UnifiedStreamWriter,
  ) {}

  async start(emit: (signal: UnifiedSignal) => Promise<void>): Promise<void> {
    if (!this.cfg.enabled) {
      console.info('[launchpad-scout] disabled (set LAUNCHPAD_SCOUT_ENABLED=true)')
      return
    }

    console.info('[launchpad-scout] started — webhook primary; poll=', this.cfg.pollMs > 0)

    // Polling is a backup: Helius webhook → Next route should own the firehose.
    // Here we peek recent token metadata via DAS searchAssets (cheap) when configured.
    if (this.cfg.pollMs > 0) {
      const tick = () => void this.pollOnce(emit).catch((e) => {
        console.warn('[launchpad-scout] poll', e instanceof Error ? e.message : e)
      })
      tick()
      this.timer = setInterval(tick, this.cfg.pollMs)
    }

    // Keep process alive; webhook path still uses writer via Next when shared Redis.
    while (!this.stopped) {
      await new Promise((r) => setTimeout(r, 30_000))
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async pollOnce(emit: (signal: UnifiedSignal) => Promise<void>): Promise<void> {
    // Lightweight: search recent fungible tokens via Helius DAS (bounded page).
    const url = `https://mainnet.helius-rpc.com/?api-key=${this.cfg.heliusApiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'launchpad-scout',
        method: 'getAssetsByGroup',
        params: {
          groupKey: 'collection',
          groupValue: 'pump',
          page: 1,
          limit: 20,
        },
      }),
    })
    if (!res.ok) return
    const json = (await res.json()) as {
      result?: { items?: Array<{ id?: string; content?: { metadata?: { symbol?: string; name?: string } } }> }
    }
    const items = json.result?.items ?? []
    for (const item of items) {
      const mint = item.id
      if (!mint) continue
      if (
        !mintPassesPrefilter(
          mint,
          {},
          { minLiquidityUsd: this.cfg.minLiquidityUsd, minAgeSec: this.cfg.minAgeSec },
        )
      ) {
        continue
      }
      const sig = buildLaunchpadSignal({
        mint,
        symbol: item.content?.metadata?.symbol,
        label: item.content?.metadata?.name,
      })
      await emit(sig)
      await this.writer.write(sig)
    }
  }
}
