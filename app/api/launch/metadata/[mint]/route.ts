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

  const extensions: Record<string, string> = {
    platform: 'CryptoCheck',
    mint: meta.mint,
  }
  if (meta.website) extensions.website = meta.website
  if (meta.twitter) extensions.twitter = meta.twitter
  if (meta.telegram) extensions.telegram = meta.telegram
  if (meta.discord) extensions.discord = meta.discord
  if (meta.checksumSha256) extensions.checksumSha256 = meta.checksumSha256

  return NextResponse.json(
    {
      name: meta.name,
      symbol: meta.symbol,
      description: meta.description,
      image: meta.image,
      ...(meta.external_url || meta.website
        ? { external_url: meta.external_url || meta.website }
        : {}),
      extensions,
    },
    {
      headers: {
        'cache-control': 'public, max-age=60',
        'content-type': 'application/json',
      },
    },
  )
}
