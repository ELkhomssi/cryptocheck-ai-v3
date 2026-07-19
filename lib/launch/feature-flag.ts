/**
 * Token create / LAUNCH mode gate.
 *
 * Devnet-only until Task 2–5 are proven green:
 * - NEXT_PUBLIC_LAUNCH_MODE_ENABLED=true|1|yes
 * - LAUNCHLAB_CLUSTER unset or =devnet
 * - LAUNCHLAB_PLATFORM_ID must be set (checked at prepare)
 *
 * Mainnet launch requires explicit LAUNCH_MODE_ALLOW_MAINNET=true
 * after the full happy-path evidence trail.
 *
 * Client-safe: only reads NEXT_PUBLIC_* / LAUNCH_* env strings (no Raydium SDK).
 */
function isMainnetCluster(): boolean {
  const raw = (process.env.LAUNCHLAB_CLUSTER ?? process.env.NEXT_PUBLIC_LAUNCHLAB_CLUSTER ?? 'devnet')
    .trim()
    .toLowerCase()
  return raw === 'mainnet' || raw === 'mainnet-beta'
}

export function isLaunchModeEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_LAUNCH_MODE_ENABLED ?? '').trim().toLowerCase()
  if (raw !== '1' && raw !== 'true' && raw !== 'yes') return false

  if (isMainnetCluster()) {
    const allow = (process.env.LAUNCH_MODE_ALLOW_MAINNET ?? '').trim().toLowerCase()
    return allow === '1' || allow === 'true' || allow === 'yes'
  }
  return true
}
