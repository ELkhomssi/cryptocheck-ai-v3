import 'dotenv/config'
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

  const heartbeat = createServiceHeartbeat('telegram-monitor')

  // Always read live health — do NOT cache channelsJoined in a local var (that stuck at 0
  // while /health reported 22 and the dashboard chip showed "0 Channels").
  heartbeat.start(() => {
    const joined = getHealthSnapshot().telegram?.channelsJoined ?? 0
    return {
      status: joined > 0 ? 'ok' : config.telegram ? 'degraded' : 'down',
      channels: joined,
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

  // Immediate heartbeat refresh after joins so Redis isn't stuck at channels:0
  await heartbeat.beat({
    status: (getHealthSnapshot().telegram?.channelsJoined ?? 0) > 0 ? 'ok' : 'degraded',
    channels: getHealthSnapshot().telegram?.channelsJoined ?? 0,
  })

  const discovery =
    config.telegram && process.env.SIGNAL_DISCOVERY_ENABLED !== 'false'
      ? startDiscoveryLoop()
      : null

  const shutdown = async (signal: string) => {
    console.info('[signal-ingestion] shutting down', { signal })
    discovery?.stop()
    await heartbeat.beat({ status: 'down', channels: 0 })
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
