import {
  SIGNAL_AGENT_CONTROL_KEY,
  type AgentConfig,
  type AgentControlState,
} from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'

/** Merge dashboard control plane into in-process agent config. */
export async function applyControlFromRedis(
  redis: Redis | null,
  config: AgentConfig,
): Promise<AgentConfig> {
  if (!redis) return config
  try {
    const raw = await redis.get<string | AgentControlState>(SIGNAL_AGENT_CONTROL_KEY)
    if (!raw) return config
    const control = (typeof raw === 'string' ? JSON.parse(raw) : raw) as AgentControlState
    return {
      ...config,
      enabled: typeof control.enabled === 'boolean' ? control.enabled : config.enabled,
      killSwitch: typeof control.killSwitch === 'boolean' ? control.killSwitch : config.killSwitch,
      mode: control.mode === 'live' || control.mode === 'paper' ? control.mode : config.mode,
      edgeThreshold:
        typeof control.edgeThreshold === 'number' ? control.edgeThreshold : config.edgeThreshold,
      confidenceFloor:
        typeof control.confidenceFloor === 'number'
          ? control.confidenceFloor
          : config.confidenceFloor,
      maxPositionSize:
        typeof control.maxPositionSize === 'number'
          ? control.maxPositionSize
          : config.maxPositionSize,
      perMatchCap: typeof control.perMatchCap === 'number' ? control.perMatchCap : config.perMatchCap,
      dailyLossLimit:
        typeof control.dailyLossLimit === 'number'
          ? control.dailyLossLimit
          : config.dailyLossLimit,
    }
  } catch {
    return config
  }
}
