import 'dotenv/config'
import { createAdapters } from './adapters/index.js'
import { loadConfig } from './config.js'
import { startHealthServer } from './health.js'
import { createUnifiedStreamWriter } from './unified-stream.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const writers = new Map(
    config.sources.map((tag) => [tag, createUnifiedStreamWriter(tag, config.unifiedStreamMaxLen)]),
  )
  startHealthServer(config, writers)

  if (config.telegram?.channels.length === 0) {
    console.warn('[signal-ingestion] telegram channel shard is empty — add public channels to config/channels.json')
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

  const shutdown = async (signal: string) => {
    console.info('[signal-ingestion] shutting down', { signal })
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
