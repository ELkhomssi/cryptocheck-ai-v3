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
}
