/**
 * Scout Discovery Agent loop — Node-only (same process as ingestion).
 *
 * Loop:
 *   1. runChannelScout() — curated seeds + optional search API → enroll
 *   2. hygiene filter on candidates (scam keywords)
 *   3. seed signal_channel_metrics priors from reputationScore
 *   4. (gate worker separately updates metrics from verdicts)
 *
 * Not a separate Python crawler: Telegram public search requires either
 * GramJS ContactsSearch (rate-limited) or an external index (TGStat-style API
 * via SCOUT_TELEGRAM_SEARCH_API_URL). That is intentional — no private scrapers.
 */
import { loadScoutConfig, runChannelScout, type ScoutResult } from '../scout.js'
import { passesDiscoveryHygiene } from './scam-heuristics.js'
import { upsertDiscoveryPrior } from './channel-metrics.js'

export type DiscoveryLoopHandle = {
  stop: () => void
}

const DEFAULT_INTERVAL_MS = Number(process.env.SIGNAL_DISCOVERY_INTERVAL_MS ?? 3_600_000) // 1h

export async function runDiscoveryOnce(): Promise<ScoutResult> {
  const cfg = loadScoutConfig()
  const telegramPlatform = cfg.platforms.find((p) => p.platform === 'telegram')
  const curated = telegramPlatform?.curated ?? []

  // Pre-seed trust priors for curated + seed-file handles (idempotent merge).
  for (const c of curated) {
    const hygiene = passesDiscoveryHygiene({
      handle: c.handle,
      label: c.label,
      audienceSize: c.audienceSize,
      minAudience: 0,
    })
    if (!hygiene.ok) continue
    await upsertDiscoveryPrior({
      channelId: c.handle,
      trustPrior: c.reputationScore ?? 55,
      audienceSize: c.audienceSize,
      engagementScore: c.reputationScore,
    })
  }

  const result = await runChannelScout(cfg)

  const tg = result.platforms.find((p) => p.platform === 'telegram')
  if (tg?.insertedHandles?.length) {
    for (const handle of tg.insertedHandles) {
      const seed = curated.find((s) => s.handle.toLowerCase() === handle.toLowerCase())
      await upsertDiscoveryPrior({
        channelId: handle,
        trustPrior: seed?.reputationScore ?? 55,
        audienceSize: seed?.audienceSize,
        engagementScore: seed?.reputationScore ?? 55,
      })
    }
  }

  console.info('[discovery] cycle complete', {
    totalInserted: result.totalInserted,
    skipped: result.skipped,
    reason: result.reason,
    curatedTelegram: curated.length,
    platforms: result.platforms.map((p) => ({
      platform: p.platform,
      inserted: p.inserted,
      passed: p.passedFilter,
    })),
  })
  return result
}

/** Periodic discovery — call from ingestion main after Telegram boot. */
export function startDiscoveryLoop(intervalMs = DEFAULT_INTERVAL_MS): DiscoveryLoopHandle {
  console.info('[discovery] loop started', { intervalMs })
  // Stagger first run ~2 min after boot so GramJS joins settle.
  const first = setTimeout(() => {
    void runDiscoveryOnce().catch((e) =>
      console.warn('[discovery] cycle failed', e instanceof Error ? e.message : e),
    )
  }, 120_000)

  const timer = setInterval(() => {
    void runDiscoveryOnce().catch((e) =>
      console.warn('[discovery] cycle failed', e instanceof Error ? e.message : e),
    )
  }, intervalMs)

  return {
    stop: () => {
      clearTimeout(first)
      clearInterval(timer)
    },
  }
}

/** Standalone: `npm run discovery --prefix services/ingestion` */
async function main(): Promise<void> {
  const { config } = await import('dotenv')
  const { dirname, resolve } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  // Load repo-root .env.local even when run via --prefix services/ingestion
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
  config({ path: resolve(repoRoot, '.env.local') })
  config({ path: resolve(repoRoot, '.env') })
  config()
  // Map Next.js naming → worker naming for this process
  if (!process.env.SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.trim()
  }
  await runDiscoveryOnce()
  process.exit(0)
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  /(?:^|[\\/])discovery-loop\.(?:js|ts)$/.test(process.argv[1])
if (invokedDirectly) {
  void main().catch((e) => {
    console.error('[discovery] fatal', e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
