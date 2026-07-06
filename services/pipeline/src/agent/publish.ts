import {
  SIGNAL_PUBSUB_AGENT,
  SIGNAL_STREAM_AGENT,
  type AgentFeedEvent,
} from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'

const AGENT_STREAM_MAXLEN = Number(process.env.SIGNAL_AGENT_STREAM_MAXLEN ?? 10_000)

export async function publishAgentEvent(redis: Redis, event: AgentFeedEvent): Promise<void> {
  const payload = JSON.stringify(event)
  await redis.publish(SIGNAL_PUBSUB_AGENT, payload)
  await redis.xadd(
    SIGNAL_STREAM_AGENT,
    '*',
    { data: payload },
    {
      trim: { type: 'MAXLEN', comparison: '~', threshold: AGENT_STREAM_MAXLEN },
    },
  )
}
