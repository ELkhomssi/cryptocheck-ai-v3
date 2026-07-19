/**
 * Server bootstrap (Node runtime only). Misconfigured production signing must exit the process.
 * Imports only `env.ts` (no Node `crypto`) so the instrumentation bundle stays valid.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return

  const { assertSentinelSigningOnStartup, FatalSentinelSigningMisconfiguration } = await import(
    '@/lib/security/signing/env'
  )
  try {
    assertSentinelSigningOnStartup()
  } catch (e) {
    if (e instanceof FatalSentinelSigningMisconfiguration) {
      console.error(e.message)
      throw e
    }
    throw e
  }

  // LaunchLab boot guard — skip when platform env unset (Scan/Swap/Sniper still boot).
  const hasPlatform =
    Boolean(process.env.LAUNCHLAB_PLATFORM_ID_DEVNET?.trim()) ||
    Boolean(process.env.LAUNCHLAB_PLATFORM_ID_MAINNET?.trim()) ||
    Boolean(process.env.LAUNCHLAB_PLATFORM_ID?.trim())
  if (!hasPlatform) return

  try {
    const { Connection } = await import('@solana/web3.js')
    const { getRpcUrl } = await import('@/lib/launch/config')
    const { assertLaunchConfigValid, bootGuardOrThrow } = await import('@/lib/launch/guards')
    assertLaunchConfigValid()
    const connection = new Connection(getRpcUrl(), 'confirmed')
    await bootGuardOrThrow(connection)
  } catch (e) {
    // Log only — never brick landing / Scan / Swap / Sniper for a LaunchLAB platform
    // misconfig. Prepare/confirm routes still enforce guards at request time.
    console.error(
      '[launch-boot-guard] non-fatal:',
      e instanceof Error ? e.message : e,
      '— set LAUNCHLAB_PLATFORM_ID to the PlatformConfig PDA (not a wallet).',
    )
  }
}
