import 'dotenv/config'
import { createAdapters } from './adapters/index.js'
import { resolveTelegramChannelList, startChannelRegistryRefresh } from './channel-registry.js'
import { loadConfig, shardChannels } from './config.js'
import { getHealthSnapshot, startHealthServer } from './health.js'
import { createServiceHeartbeat } from './service-heartbeat.js'
import { createUnifiedStreamWriter } from './unified-stream.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const writers = new Map(
    config.sources.map((tag) => [tag, createUnifiedStreamWriter(tag, config.unifiedStreamMaxLen)]),
  )
  startHealthServer(config, writers)

  const heartbeat = createServiceHeartbeat('telegram-monitor')
  let channelsJoined = 0

  heartbeat.start(() => ({
    status: channelsJoined > 0 ? 'ok' : config.telegram ? 'degraded' : 'down',
    channels: channelsJoined,
  }))

  if (config.telegram) {
    const allChannels = await resolveTelegramChannelList(config.telegram.channelsConfigPath)
    config.telegram.channels = shardChannels(
      allChannels,
      config.telegram.sessionIndex,
      config.telegram.sessionCount,
    )

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

  const channelPoll = setInterval(() => {
    channelsJoined = getHealthSnapshot().telegram?.channelsJoined ?? 0
  }, 5_000)

  const shutdown = async (signal: string) => {
    console.info('[signal-ingestion] shutting down', { signal })
    clearInterval(channelPoll)
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
