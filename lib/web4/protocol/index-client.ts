/** Fire-and-forget protocol metrics indexing after confirmed txs. */
export async function reportProtocolEvent(event: {
  type: 'trade' | 'graduate' | 'deploy'
  lamports?: bigint
  wallet?: string
}) {
  try {
    await fetch('/api/web4/protocol/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: event.type,
        lamports: event.lamports?.toString(),
        wallet: event.wallet,
      }),
    })
  } catch {
    /* non-blocking */
  }
}
