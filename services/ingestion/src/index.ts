import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

// Repo-root .env.local (Next.js) + cwd .env — workers often run from services/ingestion.
loadEnv({ path: resolve(process.cwd(), '../../.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv()

import { createAdapters } from './adapters/index.js'
import { resolveTelegramChannelList, startChannelRegistryRefresh } from './channel-registry.js'
import { loadConfig, shardChannels } from './config.js'
import { startDiscoveryLoop } from './discovery/discovery-loop.js'
import { getHealthSnapshot, startHealthServer, updateHealth } from './health.js'
import { loadScoutConfig, runChannelScout } from './scout.js'
import { createServiceHeartbeat } from './service-heartbeat.js'
import { createUnifiedStreamWriter } from './unified-stream.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const writers = new Map(
    config.sources.map((tag) => [tag, createUnifiedStreamWriter(tag, config.unifiedStreamMaxLen)]),
  )
  startHealthServer(config, writers)

  const telegramHeartbeat = createServiceHeartbeat('telegram-monitor')
  const twitterHeartbeat = config.twitter ? createServiceHeartbeat('twitter-monitor') : null

  telegramHeartbeat.start(() => {
    const joined = getHealthSnapshot().telegram?.channelsJoined ?? 0
    return {
      status: joined > 0 ? 'ok' : config.telegram ? 'degraded' : 'down',
      channels: joined,
    }
  })

  twitterHeartbeat?.start(() => {
    const tw = getHealthSnapshot().twitter
    const handles = tw?.handleCount ?? 0
    return {
      status: handles > 0 && !tw?.lastError ? 'ok' : handles > 0 ? 'degraded' : 'down',
      channels: handles,
    }
  })

  if (config.telegram) {
    // Scout first so the allowlist has the latest top-performing channels before we read it.
    const scoutCfg = loadScoutConfig()
    if (scoutCfg.enabled) {
      try {
        const scouted = await runChannelScout(scoutCfg)
        console.info('[signal-ingestion] source scout', {
          totalInserted: scouted.totalInserted,
          skipped: scouted.skipped,
          reason: scouted.reason,
          platforms: scouted.platforms.map((p) => ({
            platform: p.platform,
            inserted: p.inserted,
            passed: p.passedFilter,
            alreadyPresent: p.alreadyPresent,
            reason: p.reason,
          })),
        })
      } catch (e) {
        console.warn('[signal-ingestion] channel scout failed (non-fatal)', e instanceof Error ? e.message : e)
      }
    }

    const allChannels = await resolveTelegramChannelList(config.telegram.channelsConfigPath)
    config.telegram.channels = shardChannels(
      allChannels,
      config.telegram.sessionIndex,
      config.telegram.sessionCount,
    )
    updateHealth({
      config: {
        channelsConfigPath: config.telegram.channelsConfigPath,
        channelShard: config.telegram.channels,
      },
    })

    startChannelRegistryRefresh(config.telegram.channelsConfigPath, (nextAll) => {
      const next = shardChannels(
        nextAll,
        config.telegram!.sessionIndex,
        config.telegram!.sessionCount,
      )
      if (next.join(',') !== config.telegram!.channels.join(',')) {
        console.info('[signal-ingestion] channel list changed — restart service to re-join', {
          was: config.telegram!.channels.length,
          now: next.length,
        })
      }
    })

    if (config.telegram.channels.length === 0) {
      console.warn(
        '[signal-ingestion] no Telegram channels configured — add rows to telegram_channels or config/channels.json',
      )
    }
  }

  const running = createAdapters(config, writers)

  await Promise.all(
    running.map(({ adapter }) =>
      adapter.start(async (signal) => {
          console.debug(`[${adapter.sourceTag}] emitted`, {
            id: signal.id,
            label: signal.label,
            type: signal.type,
            subjectType: signal.subjectType,
          })
      }),
    ),
  )

  await telegramHeartbeat.beat({
    status: (getHealthSnapshot().telegram?.channelsJoined ?? 0) > 0 ? 'ok' : 'degraded',
    channels: getHealthSnapshot().telegram?.channelsJoined ?? 0,
  })
  await twitterHeartbeat?.beat({
    status: (getHealthSnapshot().twitter?.handleCount ?? 0) > 0 ? 'ok' : 'degraded',
    channels: getHealthSnapshot().twitter?.handleCount ?? 0,
  })

  const discovery =
    config.telegram && process.env.SIGNAL_DISCOVERY_ENABLED !== 'false'
      ? startDiscoveryLoop()
      : null

  const shutdown = async (signal: string) => {
    console.info('[signal-ingestion] shutting down', { signal })
    discovery?.stop()
    await telegramHeartbeat.beat({ status: 'down', channels: 0 })
    await twitterHeartbeat?.beat({ status: 'down', channels: 0 })
    await Promise.all(running.map(({ adapter }) => adapter.stop()))
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((e) => {
  console.error('[signal-ingestion] fatal', e instanceof Error ? e.message : e)
  process.exit(1)
})
