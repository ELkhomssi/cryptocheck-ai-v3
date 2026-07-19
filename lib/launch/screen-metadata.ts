/**
 * Pre-launch metadata screening — basic ruleset to refuse building a launch tx
 * for obvious scam / impersonation patterns. Not a guarantee against all rugs.
 */

const IMPERSONATION =
  /\b(official|verified|real|legit)?\s*(solana|sol|usdc|usdt|bitcoin|btc|ethereum|eth|binance|coinbase|phantom|jupiter|raydium|pump\.?fun|bonk|wif|trump)\b/i

const SCAM_PHRASES =
  /\b(100x\s*guaranteed|guaranteed\s*profit|risk[\s-]*free|send\s*sol\s*to\s*claim|airdrop\s*claim|double\s*your|elon\s*musk|sec\s*approved|honeypot|rug\s*soon)\b/i

const TICKER_BLOCKLIST = new Set([
  'SOL',
  'WSOL',
  'USDC',
  'USDT',
  'BTC',
  'ETH',
  'BONK',
  'JUP',
  'RAY',
  'WIF',
  'TRUMP',
])

const SUSPICIOUS_TLDS = /\.(tk|ml|ga|cf|gq|xyz|top|click|buzz)(\/|$)/i

export type MetadataScreenInput = {
  name: string
  ticker: string
  description?: string
  imageUrl: string
}

export function screenLaunchMetadata(input: MetadataScreenInput): string[] {
  const reasons: string[] = []
  const name = input.name.trim()
  const ticker = input.ticker.trim().toUpperCase()
  const description = (input.description ?? '').trim()
  const imageUrl = input.imageUrl.trim()

  if (!name || name.length < 2 || name.length > 32) {
    reasons.push('Name must be 2–32 characters')
  }
  if (!/^[A-Za-z0-9 ._\-]{2,32}$/.test(name)) {
    reasons.push('Name contains invalid characters')
  }
  if (!ticker || ticker.length < 2 || ticker.length > 10) {
    reasons.push('Ticker must be 2–10 characters')
  }
  if (!/^[A-Z0-9]{2,10}$/.test(ticker)) {
    reasons.push('Ticker must be alphanumeric (A–Z, 0–9)')
  }
  if (TICKER_BLOCKLIST.has(ticker)) {
    reasons.push(`Ticker "${ticker}" impersonates a known asset`)
  }
  if (IMPERSONATION.test(name) || IMPERSONATION.test(description)) {
    reasons.push('Name/description looks like brand impersonation')
  }
  if (SCAM_PHRASES.test(name) || SCAM_PHRASES.test(description)) {
    reasons.push('Metadata matches known scam phrasing')
  }
  if (description.length > 500) {
    reasons.push('Description too long (max 500 chars)')
  }

  if (!imageUrl) {
    reasons.push('Image URL is required')
  } else if (imageUrl.startsWith('data:')) {
    if (imageUrl.length > 280_000) {
      reasons.push('Image data URL too large (max ~200KB)')
    }
    if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(imageUrl)) {
      reasons.push('Image data URL must be png/jpeg/webp/gif')
    }
  } else {
    try {
      const u = new URL(imageUrl)
      if (u.protocol !== 'https:') {
        reasons.push('Image URL must use HTTPS')
      }
      if (SUSPICIOUS_TLDS.test(u.hostname)) {
        reasons.push('Image host TLD is commonly abused for scams')
      }
    } catch {
      reasons.push('Image URL is invalid')
    }
  }

  // Homoglyph / zero-width tricks
  if (/[\u200B-\u200D\uFEFF]/.test(name) || /[\u200B-\u200D\uFEFF]/.test(ticker)) {
    reasons.push('Hidden Unicode characters are not allowed')
  }

  return reasons
}
