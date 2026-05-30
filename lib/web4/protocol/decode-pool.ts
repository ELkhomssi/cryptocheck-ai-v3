import { PublicKey } from '@solana/web3.js'
import type { PoolAccountSnapshot } from './types'

const DISC = 8

/** Anchor `Pool` account layout (must match programs/web4-launchpad). */
export function decodePoolAccount(data: Buffer): PoolAccountSnapshot | null {
  if (data.length < DISC + 32 + 8 * 4 + 3) return null

  let o = DISC
  const mint = new PublicKey(data.subarray(o, o + 32))
  o += 32
  const virtualSolLamports = data.readBigUInt64LE(o)
  o += 8
  const virtualTokenBase = data.readBigUInt64LE(o)
  o += 8
  const realSolLamports = data.readBigUInt64LE(o)
  o += 8
  const tokensSoldBase = data.readBigUInt64LE(o)
  o += 8
  const graduated = data[o] === 1
  o += 1
  const bump = data[o]
  o += 1
  const vaultBump = data[o]
  o += 1

  const nameLen = data.readUInt32LE(o)
  o += 4
  if (o + nameLen > data.length) return null
  const name = data.subarray(o, o + nameLen).toString('utf8')
  o += nameLen

  const symLen = data.readUInt32LE(o)
  o += 4
  if (o + symLen > data.length) return null
  const symbol = data.subarray(o, o + symLen).toString('utf8')

  return {
    mint: mint.toBase58(),
    virtualSolLamports,
    virtualTokenBase,
    realSolLamports,
    tokensSoldBase,
    graduated,
    bump,
    vaultBump,
    name,
    symbol,
  }
}
