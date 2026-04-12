import { NextResponse } from 'next/server'
export async function GET() {
  try {
    const res = await fetch('https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112',{next:{revalidate:30}})
    const data = await res.json()
    const price = data?.data?.So11111111111111111111111111111111111111112?.price
    if (!price) {
      const cg = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',{next:{revalidate:60}})
      const cgd = await cg.json()
      return NextResponse.json({price:cgd?.solana?.usd||80,source:'coingecko'})
    }
    return NextResponse.json({price,source:'jupiter'})
  } catch { return NextResponse.json({price:80,source:'fallback'}) }
}
