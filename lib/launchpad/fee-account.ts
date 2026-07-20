import 'server-only'

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import {
  getPlatformFeeAccount,
  getPlatformFeeAuthority,
  resolvePlatformFeeAccountForMint,
} from '@/lib/trading/platform-fee-config'

/**
 * Jupiter platform fees require `feeAccount` to be an ATA for the *output* mint.
 * If missing / wrong mint → fail before disclose+sign (no silent zero-fee swap).
 */
export type FeeAccountCheck =
  | { ok: true; feeAccount: string }
  | {
      ok: false
      code: 'FEE_ATA_MISSING' | 'FEE_ATA_MINT_MISMATCH' | 'FEE_NOT_CONFIGURED'
      message: string
    }

function rpcUrl(): string {
  return (
    process.env.HELIUS_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  )
}

function loadFeeAuthorityKeypair(): Keypair | null {
  const raw =
    process.env.PLATFORM_FEE_AUTHORITY_SECRET?.trim() ||
    process.env.LAUNCHLAB_PLATFORM_ADMIN_SECRET?.trim()
  if (!raw) return null
  try {
    if (raw.startsWith('[')) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]))
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }
    return Keypair.fromSecretKey(bs58.decode(raw))
  } catch {
    return null
  }
}

/** Ensure fee ATA exists for output mint (idempotent create when authority secret present). */
export async function ensurePlatformFeeAtaForOutput(outputMint: string): Promise<FeeAccountCheck> {
  const resolved = resolvePlatformFeeAccountForMint(outputMint)
  if (!resolved) {
    return {
      ok: false,
      code: 'FEE_NOT_CONFIGURED',
      message:
        'Platform fee not configured — set NEXT_PUBLIC_PLATFORM_FEE_AUTHORITY (or NEXT_PUBLIC_PLATFORM_FEE_ACCOUNT)',
    }
  }

  const connection = new Connection(rpcUrl(), 'confirmed')
  let pubkey: PublicKey
  try {
    pubkey = new PublicKey(resolved)
  } catch {
    return { ok: false, code: 'FEE_ATA_MISSING', message: 'Invalid fee account' }
  }

  const info = await connection.getParsedAccountInfo(pubkey, 'confirmed')
  if (info.value) {
    const parsed = info.value.data
    if (typeof parsed === 'object' && parsed !== null && 'parsed' in parsed) {
      const mint = (parsed as { parsed?: { info?: { mint?: string } } }).parsed?.info?.mint
      if (mint && mint !== outputMint) {
        return {
          ok: false,
          code: 'FEE_ATA_MINT_MISMATCH',
          message: `Fee ATA is for mint ${mint.slice(0, 8)}… but swap output is ${outputMint.slice(0, 8)}….`,
        }
      }
    }
    return { ok: true, feeAccount: resolved }
  }

  // Fixed legacy account that doesn't exist — cannot auto-create without authority match
  const fixed = getPlatformFeeAccount()
  if (fixed) {
    return {
      ok: false,
      code: 'FEE_ATA_MISSING',
      message:
        'Fee account ATA does not exist for this route. Run npm run create:referral-ata for this output mint.',
    }
  }

  const authority = getPlatformFeeAuthority()
  const kp = loadFeeAuthorityKeypair()
  if (!authority || !kp || kp.publicKey.toBase58() !== authority) {
    return {
      ok: false,
      code: 'FEE_ATA_MISSING',
      message:
        'Fee ATA missing for this output mint. Set PLATFORM_FEE_AUTHORITY_SECRET (matching NEXT_PUBLIC_PLATFORM_FEE_AUTHORITY) so the server can create it, or pre-create with npm run create:referral-ata.',
    }
  }

  const mint = new PublicKey(outputMint)
  const ata = getAssociatedTokenAddressSync(
    mint,
    kp.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )
  const ix = createAssociatedTokenAccountIdempotentInstruction(
    kp.publicKey,
    ata,
    kp.publicKey,
    mint,
  )
  const tx = new Transaction().add(ix)
  await sendAndConfirmTransaction(connection, tx, [kp], { commitment: 'confirmed' })
  return { ok: true, feeAccount: ata.toBase58() }
}

export async function assertPlatformFeeAccountForOutput(
  outputMint: string,
): Promise<FeeAccountCheck> {
  return ensurePlatformFeeAtaForOutput(outputMint)
}
