/**
 * Browser helper — sign stays in wallet; optional server Jito/RPC submit.
 * Falls back to local Connection.sendRawTransaction on failure / 401.
 */
import type { Connection, VersionedTransaction } from '@solana/web3.js'

function txToBase64(signed: VersionedTransaction): string {
  const bytes = signed.serialize()
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

export async function sendSignedSwap(opts: {
  signed: VersionedTransaction
  connection: Connection
  strategy?: string
  opportunityId?: string | null
}): Promise<{ signature: string; via: 'server' | 'client'; bundleId?: string }> {
  const signedTxBase64 = txToBase64(opts.signed)

  try {
    const res = await fetch('/api/execution/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signedTxBase64,
        strategy: opts.strategy ?? 'balanced',
        opportunityId: opts.opportunityId ?? undefined,
        allowRpcFallback: true,
      }),
    })
    if (res.status !== 401) {
      const body = (await res.json().catch(() => ({}))) as {
        signature?: string
        bundleId?: string
        error?: string
        ok?: boolean
      }
      if (res.ok && body.signature) {
        return { signature: body.signature, via: 'server', bundleId: body.bundleId }
      }
      // Bundle accepted without signature — still send via RPC for a confirmable sig.
      if (res.ok && body.bundleId && !body.signature) {
        const sig = await opts.connection.sendRawTransaction(opts.signed.serialize(), {
          skipPreflight: false,
        })
        await opts.connection.confirmTransaction(sig, 'confirmed')
        return { signature: sig, via: 'server', bundleId: body.bundleId }
      }
    }
  } catch {
    // client fallback
  }

  const sig = await opts.connection.sendRawTransaction(opts.signed.serialize(), {
    skipPreflight: false,
  })
  await opts.connection.confirmTransaction(sig, 'confirmed')
  return { signature: sig, via: 'client' }
}
