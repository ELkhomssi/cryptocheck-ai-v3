import 'server-only'

const WSOL = 'So11111111111111111111111111111111111111112'

const PRICE_URLS = [
  `https://api.jup.ag/price/v2?ids=${WSOL}`,
  `https://lite-api.jup.ag/price/v2?ids=${WSOL}`,
]

/** Live SOL/USD for swap quotes and fee displays. */
export async function fetchSolUsdPrice(): Promise<number> {
  for (const url of PRICE_URLS) {
    try {
      const headers: HeadersInit = { Accept: 'application/json' }
      const key = process.env.JUPITER_API_KEY?.trim()
      if (key) (headers as Record<string, string>)['x-api-key'] = key
      const res = await fetch(url, { headers, next: { revalidate: 30 } })
      if (!res.ok) continue
      const data = (await res.json()) as {
        data?: Record<string, { price?: number | string }>
      }
      const raw = data?.data?.[WSOL]?.price
      const price = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isFinite(price) && price > 0) return price
    } catch {
      /* try next host */
    }
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
