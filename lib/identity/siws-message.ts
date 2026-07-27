/**
 * Phase 18 — pure SIWS message + ed25519 verify (no DB / server-only).
 */

import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'

export function buildSiwsMessage(input: {
  domain: string
  wallet: string
  nonce: string
  issuedAt: string
  expiresAt: string
}): string {
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.wallet,
    '',
    'CryptoCheck AI — Sign-In With Solana',
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expires At: ${input.expiresAt}`,
  ].join('\n')
}

export function verifySiwsSignature(input: {
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
