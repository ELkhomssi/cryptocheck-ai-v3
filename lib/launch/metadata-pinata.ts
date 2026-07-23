import 'server-only'
import { createHash } from 'crypto'

export type PinataJsonResult = {
  cid: string
  uri: string
  checksumSha256: string
}

function pinataJwt(): string | null {
  return process.env.PINATA_JWT?.trim() || null
}

export function isPinataConfigured(): boolean {
  return Boolean(pinataJwt())
}

async function pinataFetch(path: string, init: RequestInit, attempt = 1): Promise<Response> {
  const jwt = pinataJwt()
  if (!jwt) throw new Error('PINATA_JWT is not configured')
  const res = await fetch(`https://api.pinata.cloud${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, attempt * 400))
    return pinataFetch(path, init, attempt + 1)
  }
  return res
}

/**
 * Upload token metadata JSON to Pinata IPFS.
 * Returns ipfs:// URI + sha256 checksum of the exact JSON bytes pinned.
 */
export async function pinLaunchMetadataJson(meta: {
  name: string
  symbol: string
  description: string
  image: string
  external_url?: string
  extensions?: Record<string, string>
}): Promise<PinataJsonResult> {
  const body = {
    name: meta.name,
    symbol: meta.symbol,
    description: meta.description,
    image: meta.image,
    ...(meta.external_url ? { external_url: meta.external_url } : {}),
    ...(meta.extensions && Object.keys(meta.extensions).length
      ? { extensions: meta.extensions }
      : {}),
  }
  const json = JSON.stringify(body)
  const checksumSha256 = createHash('sha256').update(json).digest('hex')

  const res = await pinataFetch('/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pinataContent: body,
      pinataMetadata: {
        name: `ccai-launch-${meta.symbol}-${checksumSha256.slice(0, 8)}`,
      },
      pinataOptions: { cidVersion: 1 },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Pinata pinJSON failed HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as { IpfsHash?: string }
  if (!data.IpfsHash) throw new Error('Pinata response missing IpfsHash')

  return {
    cid: data.IpfsHash,
    uri: `ipfs://${data.IpfsHash}`,
    checksumSha256,
  }
}

/**
 * If image is a data URL, pin the binary to IPFS and return an https gateway URL
 * suitable for Metaplex metadata `image` fields.
 */
export async function pinLaunchImageIfDataUrl(image: string): Promise<string> {
  if (!image.startsWith('data:')) return image
  const jwt = pinataJwt()
  if (!jwt) return image

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(image)
  if (!match) throw new Error('Invalid image data URL')
  const mime = match[1]
  const buf = Buffer.from(match[2], 'base64')
  if (buf.length > 200_000) throw new Error('Image exceeds 200KB')

  const form = new FormData()
  const blob = new Blob([new Uint8Array(buf)], { type: mime })
  const ext = mime.includes('png')
    ? 'png'
    : mime.includes('webp')
      ? 'webp'
      : mime.includes('gif')
        ? 'gif'
        : 'jpg'
  form.append('file', blob, `logo.${ext}`)
  form.append('pinataMetadata', JSON.stringify({ name: `ccai-launch-logo-${Date.now()}` }))

  const res = await pinataFetch('/pinning/pinFileToIPFS', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Pinata pinFile failed HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { IpfsHash?: string }
  if (!data.IpfsHash) throw new Error('Pinata file response missing IpfsHash')
  const gateway =
    process.env.PINATA_GATEWAY?.trim() ||
    process.env.METADATA_UPLOAD_URL?.trim() ||
    'https://gateway.pinata.cloud/ipfs'
  return `${gateway.replace(/\/$/, '')}/${data.IpfsHash}`
}
