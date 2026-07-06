import 'server-only'

const WSOL = 'So11111111111111111111111111111111111111112'

/** Live SOL/USD for swap quotes and fee displays. */
export async function fetchSolUsdPrice(): Promise<number> {
  try {
    const res = await fetch(`https://price.jup.ag/v6/price?ids=${WSOL}`, {
      next: { revalidate: 30 },
    })
    const data = (await res.json()) as {
      data?: Record<string, { price?: number }>
    }
    const price = data?.data?.[WSOL]?.price
    if (typeof price === 'number' && price > 0) return price
  } catch {
    /* fall through */
  }
  try {
    const cg = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { next: { revalidate: 60 } },
    )
    const cgd = (await cg.json()) as { solana?: { usd?: number } }
    if (typeof cgd?.solana?.usd === 'number') return cgd.solana.usd
  } catch {
    /* fall through */
  }
  return 150
}
