/**
 * Launch-mode operational kill-switch — independent of Scan/Swap/Sniper.
 *
 * Pause sources (any true → reject new prepares instantly):
 * 1. Env LAUNCH_MODE_PAUSED=true|1|yes  (Vercel env flip; no code redeploy of app binary required on serverless)
 * 2. Redis key ccai:launch:paused=1     (true zero-redeploy when Upstash is live)
 *
 * Control API: POST /api/launch/control { paused: boolean }
 */
import { redis } from '@/lib/cache/redis'

export const LAUNCH_PAUSED_REDIS_KEY = 'ccai:launch:paused'

function envPaused(): boolean {
  const raw = (process.env.LAUNCH_MODE_PAUSED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export async function isLaunchModePaused(): Promise<boolean> {
  if (envPaused()) return true
  try {
    const v = await redis.get(LAUNCH_PAUSED_REDIS_KEY)
    return v === '1' || v === 'true'
  } catch {
    return envPaused()
  }
}

export async function setLaunchModePaused(paused: boolean): Promise<{ paused: boolean; via: 'redis' | 'env-only' }> {
  try {
    if (paused) {
      await redis.set(LAUNCH_PAUSED_REDIS_KEY, '1')
    } else {
      await redis.del(LAUNCH_PAUSED_REDIS_KEY)
    }
    // Confirm write path exists (disabled redis is a no-op — fall back messaging)
    const readBack = await redis.get(LAUNCH_PAUSED_REDIS_KEY)
    if (paused && readBack !== '1' && readBack !== 'true') {
      return { paused: envPaused() || paused, via: 'env-only' }
    }
    return { paused: paused || envPaused(), via: 'redis' }
  } catch {
    return { paused: envPaused() || paused, via: 'env-only' }
  }
}

export async function getLaunchControlState(): Promise<{
  paused: boolean
  envPaused: boolean
  redisPaused: boolean
  launchModeEnabled: boolean
}> {
  let redisPaused = false
  try {
    const v = await redis.get(LAUNCH_PAUSED_REDIS_KEY)
    redisPaused = v === '1' || v === 'true'
  } catch {
    redisPaused = false
  }
  const { isLaunchModeEnabled } = await import('./feature-flag')
  return {
    paused: envPaused() || redisPaused,
    envPaused: envPaused(),
    redisPaused,
    launchModeEnabled: isLaunchModeEnabled(),
  }
}
