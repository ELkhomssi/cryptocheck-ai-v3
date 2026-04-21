export type StreamTopic = 'pnl' | 'alerts' | 'whale'

export type StreamEnvelope = {
  topic: StreamTopic
  ts: number
  payload: Record<string, unknown>
}
