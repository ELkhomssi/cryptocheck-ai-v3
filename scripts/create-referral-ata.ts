/**
 * One-time: create Jupiter referral / platform-fee ATAs for mints you charge fees on.
 *
 * Jupiter platform fees require a token account (ATA) owned by your referral authority
 * for the *output* mint of each swap. Create ATAs ahead of time for SOL/WSOL and common
 * quote mints, then set PLATFORM_FEE_ACCOUNT / NEXT_PUBLIC_PLATFORM_FEE_ACCOUNT to the
 * fee *project* account Jupiter documents (referral token account pubkey).
 *
 * Usage:
 *   PLATFORM_FEE_AUTHORITY_SECRET=<base58|json> \
 *   REFERRAL_MINTS=So11111111111111111111111111111111111111112 \
 *   TS_NODE_PROJECT=tsconfig.scripts.json npx ts-node scripts/create-referral-ata.ts
 *
 * Docs: https://station.jup.ag/docs/apis/adding-fees
 */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'

function loadKeypair(): Keypair {
  const raw = process.env.PLATFORM_FEE_AUTHORITY_SECRET?.trim()
  if (!raw) throw new Error('PLATFORM_FEE_AUTHORITY_SECRET required')
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]))
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }
  return Keypair.fromSecretKey(bs58.decode(raw))
}

async function main() {
  const owner = loadKeypair()
  const rpc =
    process.env.HELIUS_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  const connection = new Connection(rpc, 'confirmed')

  const mints = (process.env.REFERRAL_MINTS ?? 'So11111111111111111111111111111111111111112')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  console.log('[referral-ata] authority', owner.publicKey.toBase58())

  for (const mintStr of mints) {
    const mint = new PublicKey(mintStr)
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    const ix = createAssociatedTokenAccountIdempotentInstruction(
      owner.publicKey,
      ata,
      owner.publicKey,
      mint,
    )
    const tx = new Transaction().add(ix)
    const sig = await sendAndConfirmTransaction(connection, tx, [owner])
    console.log(`[referral-ata] mint=${mintStr}`)
    console.log(`  ATA=${ata.toBase58()}`)
    console.log(`  tx=${sig}`)
  }

  console.log('')
  console.log('Set NEXT_PUBLIC_PLATFORM_FEE_ACCOUNT to the Jupiter referral fee account')
  console.log('configured in the Jupiter portal (may equal an ATA above for WSOL).')
  console.log('Also set PLATFORM_FEE_BPS / NEXT_PUBLIC_PLATFORM_FEE_BPS (e.g. 50).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
