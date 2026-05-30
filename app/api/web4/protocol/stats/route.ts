import { Connection } from '@solana/web3.js'
import { NextResponse } from 'next/server'
import { GRADUATION_LAMPORTS, LAMPORTS_PER_SOL } from '@/lib/web4/bonding-curve/constants'
import { fetchAllPools } from '@/lib/web4/protocol/fetch-pools'
import { getWeb4ProgramId, isWeb4ProgramConfigured } from '@/lib/web4/protocol/config'
import { getIndexedStats } from '@/lib/web4/protocol/stats-index'
import type { ProtocolStats } from '@/lib/web4/protocol/types'

export const dynamic = 'force-dynamic'

async function fetchSolUsd(): Promise<number> {
  try {
    const origin =
      process.env.VERCEL_URL != null
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${origin}/api/web4-terminal/market`, { cache: 'no-store' })
    if (!res.ok) return 168
    const data = (await res.json()) as { solUsd?: number }
    return typeof data.solUsd === 'number' ? data.solUsd : 168
  } catch {
    return 168
  }
}

export async function GET() {
  const solUsd = await fetchSolUsd()
  let stats: ProtocolStats = {
    totalVolumeLamports: '0',
    tokensGraduated: 0,
    activePools: 0,
    connectedWalletsEstimate: 0,
    solUsd,
    updatedAt: Date.now(),
    source: 'indexed',
  }

  const indexed = await getIndexedStats(solUsd)
  if (indexed) {
    stats = { ...indexed, source: 'hybrid' as const }
  }

  if (!isWeb4ProgramConfigured()) {
    return NextResponse.json(stats)
  }

  try {
    const rpc =
      process.env.HELIUS_RPC_URL ??
      process.env.SOLANA_RPC_URL ??
      'https://api.mainnet-beta.solana.com'
    const connection = new Connection(rpc, 'confirmed')
    const pools = await fetchAllPools(connection)

    let volume = 0n
    let graduated = 0
    for (const p of pools) {
      volume += p.realSolLamports
      if (p.graduated) graduated += 1
    }

    stats = {
      totalVolumeLamports: (
        BigInt(stats.totalVolumeLamports) + volume
      ).toString(),
      tokensGraduated: Math.max(stats.tokensGraduated, graduated),
      activePools: pools.filter((p) => !p.graduated).length,
      connectedWalletsEstimate: Math.max(
        stats.connectedWalletsEstimate,
        pools.length * 8,
      ),
      solUsd,
      updatedAt: Date.now(),
      source: 'chain',
    }
  } catch {
    stats.source = 'hybrid'
  }

  return NextResponse.json({
    ...stats,
    graduationCapSol: Number(GRADUATION_LAMPORTS / LAMPORTS_PER_SOL),
    programId: getWeb4ProgramId()?.toBase58() ?? null,
  })
}
