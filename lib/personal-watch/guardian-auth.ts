import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'

const AUTH_TTL_DAYS = 30

export function buildGuardianAuthMessage(input: {
  userId: string
  wallet: string
  mint: string | '*'
  maxSlippageBps: number
  minProceedsRatio: number
  nonce: string
  expiresAt: string
}): string {
  return [
    'CryptoCheck Guardian Auto-Exit Authorization',
    `User: ${input.userId}`,
    `Wallet: ${input.wallet}`,
    `Mint: ${input.mint}`,
    `Max slippage: ${input.maxSlippageBps} bps`,
    `Min proceeds ratio: ${input.minProceedsRatio}`,
    `Expires: ${input.expiresAt}`,
    `Nonce: ${input.nonce}`,
    'I authorize CryptoCheck to prepare sell-to-SOL swap transactions for this position when a DANGER degrade is detected. I will sign each exit in my wallet — no silent background transactions.',
  ].join('\n')
}

export function guardianAuthExpiresAt(from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + AUTH_TTL_DAYS)
  return d.toISOString()
}

/** Verify ed25519 wallet signature over UTF-8 message (base64 signature from wallet). */
export function verifyGuardianWalletSignature(input: {
  wallet: string
  message: string
  signatureBase64: string
}): boolean {
  try {
    const pubkey = new PublicKey(input.wallet.trim())
    const sigBytes = Buffer.from(input.signatureBase64, 'base64')
    const msgBytes = new TextEncoder().encode(input.message)
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubkey.toBytes())
  } catch {
    return false
  }
}
