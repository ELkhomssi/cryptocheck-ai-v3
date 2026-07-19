import { NextResponse } from 'next/server'
import { readLaunchMetadata } from '@/lib/launch/metadata-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/launch/metadata/[mint] — Metaplex-style JSON for LaunchLab uri. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ mint: string }> | { mint: string } },
) {
  const params = await Promise.resolve(ctx.params)
  const mint = String(params.mint ?? '').trim()
  if (!mint) {
    return NextResponse.json({ error: 'mint required' }, { status: 400 })
  }

  const meta = await readLaunchMetadata(mint)
  if (!meta) {
    return NextResponse.json({ error: 'metadata not found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      name: meta.name,
      symbol: meta.symbol,
      description: meta.description,
      image: meta.image,
      extensions: {
        platform: 'CryptoCheck',
        mint: meta.mint,
      },
    },
    {
      headers: {
        'cache-control': 'public, max-age=60',
        'content-type': 'application/json',
      },
    },
  )
}
