import {
  SIGNAL_AGENT_CONTROL_KEY,
  type AgentControlState,
  type AgentMode,
} from '@cryptocheck/signal-contracts'
import { getAgentRedis } from './redis'

export function defaultControlState(): AgentControlState {
  return {
    enabled: process.env.SIGNAL_AGENT_ENABLED?.trim() === 'true',
    killSwitch: process.env.SIGNAL_AGENT_KILL_SWITCH?.trim() === 'true',
    mode: process.env.SIGNAL_AGENT_MODE?.trim() === 'live' ? 'live' : 'paper',
    edgeThreshold: Number(process.env.SIGNAL_AGENT_EDGE_THRESHOLD ?? 40),
    confidenceFloor: Number(process.env.SIGNAL_AGENT_CONFIDENCE_FLOOR ?? 0.55),
    maxPositionSize: Number(process.env.SIGNAL_AGENT_MAX_SIZE ?? 10),
    perMatchCap: Number(process.env.SIGNAL_AGENT_PER_MATCH_CAP ?? 25),
    dailyLossLimit: Number(process.env.SIGNAL_AGENT_DAILY_LOSS_LIMIT ?? 50),
    updatedAt: new Date().toISOString(),
  }
}

export async function readAgentControl(): Promise<AgentControlState> {
  const redis = getAgentRedis()
  if (!redis) return defaultControlState()
  const raw = await redis.get<string | AgentControlState>(SIGNAL_AGENT_CONTROL_KEY)
  if (!raw) {
    const defaults = defaultControlState()
    // Seed so gate worker and dashboard share the same control plane
    await redis.set(SIGNAL_AGENT_CONTROL_KEY, JSON.stringify(defaults))
    return defaults
  }
  try {
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as AgentControlState
    return { ...defaultControlState(), ...parsed }
  } catch {
    return defaultControlState()
  }
}

export async function writeAgentControl(
  patch: Partial<AgentControlState>,
): Promise<AgentControlState> {
  const current = await readAgentControl()
  const next: AgentControlState = {
    ...current,
    ...patch,
    mode: (patch.mode === 'live' || patch.mode === 'paper' ? patch.mode : current.mode) as AgentMode,
    updatedAt: new Date().toISOString(),
  }
  const redis = getAgentRedis()
  if (redis) {
    await redis.set(SIGNAL_AGENT_CONTROL_KEY, JSON.stringify(next))
  }
  return next
}
