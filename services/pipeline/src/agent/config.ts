import type { AgentConfig, AgentMode, EdgeDetectorId } from '@cryptocheck/signal-contracts'

const DEFAULT_DETECTORS: EdgeDetectorId[] = [
  'latency_edge',
  'line_velocity',
  'model_divergence',
]

function parseDetectors(raw: string | undefined): EdgeDetectorId[] {
  if (!raw?.trim()) return DEFAULT_DETECTORS
  const allowed = new Set<EdgeDetectorId>([
    'implied_probability',
    'latency_edge',
    'line_velocity',
    'model_divergence',
    'anomaly',
  ])
  const out: EdgeDetectorId[] = []
  for (const part of raw.split(',')) {
    const id = part.trim() as EdgeDetectorId
    if (allowed.has(id) && !out.includes(id)) out.push(id)
  }
  return out.length ? out : DEFAULT_DETECTORS
}

function parseMode(raw: string | undefined): AgentMode {
  return raw?.trim().toLowerCase() === 'live' ? 'live' : 'paper'
}

/** Load agent config from env. `SIGNAL_AGENT_ENABLED=true` is required opt-in. */
export function loadAgentConfig(): AgentConfig {
  return {
    agentId: process.env.SIGNAL_AGENT_ID?.trim() || 'sentinel-edge-1',
    enabled: process.env.SIGNAL_AGENT_ENABLED?.trim() === 'true',
    killSwitch: process.env.SIGNAL_AGENT_KILL_SWITCH?.trim() === 'true',
    mode: parseMode(process.env.SIGNAL_AGENT_MODE),
    enabledDetectors: parseDetectors(process.env.SIGNAL_AGENT_DETECTORS),
    edgeThreshold: Number(process.env.SIGNAL_AGENT_EDGE_THRESHOLD ?? 40),
    confidenceFloor: Number(process.env.SIGNAL_AGENT_CONFIDENCE_FLOOR ?? 0.55),
    maxPositionSize: Number(process.env.SIGNAL_AGENT_MAX_SIZE ?? 10),
    perMatchCap: Number(process.env.SIGNAL_AGENT_PER_MATCH_CAP ?? 25),
    dailyLossLimit: Number(process.env.SIGNAL_AGENT_DAILY_LOSS_LIMIT ?? 50),
    agentPubkey: process.env.SIGNAL_AGENT_PUBKEY?.trim() || undefined,
  }
}
