import type { Connection } from '@solana/web3.js'
import type { TxLifecycle } from './types'

export async function waitForSignature(
  connection: Connection,
  signature: string,
  onLifecycle?: (state: TxLifecycle) => void,
  blockhash?: string,
  lastValidBlockHeight?: number,
): Promise<void> {
  onLifecycle?.({ phase: 'sent', signature })

  const sub = connection.onSignature(
    signature,
    (result) => {
      if (result.err) {
        onLifecycle?.({
          phase: 'error',
          signature,
          error: JSON.stringify(result.err),
        })
        return
      }
      onLifecycle?.({ phase: 'processed', signature })
    },
    'processed',
  )

  try {
    const confirmation =
      blockhash && lastValidBlockHeight
        ? await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed',
          )
        : await connection.confirmTransaction(signature, 'confirmed')

    if (confirmation.value.err) {
      throw new Error(JSON.stringify(confirmation.value.err))
    }
    onLifecycle?.({ phase: 'confirmed', signature })

    await connection.confirmTransaction(signature, 'finalized')
    onLifecycle?.({ phase: 'finalized', signature })
  } finally {
    try {
      await connection.removeSignatureListener(sub)
    } catch {
      /* ignore */
    }
  }
}
