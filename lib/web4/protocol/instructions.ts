import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import { solToLamports } from '@/lib/web4/bonding-curve/math'
import { getWeb4ProgramId } from './config'
import { IX } from './discriminators'
import { concat, encodeString, encodeU64 } from './encode'
import { poolPda, vaultAuthorityPda } from './pda'

export type InitializePoolParams = {
  name: string
  symbol: string
  uri: string
  initialBuySol: number
}

export function buildInitializePoolInstructions(params: InitializePoolParams & {
  payer: PublicKey
  mintKeypair: Keypair
}) {
  const programId = getWeb4ProgramId()
  if (!programId) throw new Error('NEXT_PUBLIC_WEB4_PROGRAM_ID is not set')

  const mint = params.mintKeypair.publicKey
  const [pool] = poolPda(mint)
  const [vaultAuthority] = vaultAuthorityPda(mint)
  const tokenVault = getAssociatedTokenAddressSync(mint, vaultAuthority, true)
  const lamports = solToLamports(params.initialBuySol)

  const data = concat(
    IX.initializePool,
    encodeString(params.name.slice(0, 32)),
    encodeString(params.symbol.slice(0, 10)),
    encodeString(params.uri.slice(0, 200)),
    encodeU64(lamports),
  )

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: true, isWritable: true },
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: tokenVault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  })

  return { mint, pool, tokenVault, vaultAuthority, instructions: [ix] }
}

const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111')

export function buildBuyInstruction(params: {
  buyer: PublicKey
  mint: PublicKey
  solIn: number
  minTokensOut: bigint
}) {
  const programId = getWeb4ProgramId()
  if (!programId) throw new Error('NEXT_PUBLIC_WEB4_PROGRAM_ID is not set')

  const [pool] = poolPda(params.mint)
  const [vaultAuthority] = vaultAuthorityPda(params.mint)
  const buyerAta = getAssociatedTokenAddressSync(params.mint, params.buyer)
  const tokenVault = getAssociatedTokenAddressSync(params.mint, vaultAuthority, true)

  const data = concat(IX.buy, encodeU64(solToLamports(params.solIn)), encodeU64(params.minTokensOut))

  const keys = [
    { pubkey: params.buyer, isSigner: true, isWritable: true },
    { pubkey: pool, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: buyerAta, isSigner: false, isWritable: true },
    { pubkey: tokenVault, isSigner: false, isWritable: true },
    { pubkey: vaultAuthority, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  const instructions: TransactionInstruction[] = []

  instructions.push(
    new TransactionInstruction({ programId, keys, data }),
  )

  return { instructions, buyerAta }
}

export function buildSellInstruction(params: {
  seller: PublicKey
  mint: PublicKey
  tokensIn: bigint
  minSolOut: bigint
}) {
  const programId = getWeb4ProgramId()
  if (!programId) throw new Error('NEXT_PUBLIC_WEB4_PROGRAM_ID is not set')

  const [pool] = poolPda(params.mint)
  const [vaultAuthority] = vaultAuthorityPda(params.mint)
  const sellerAta = getAssociatedTokenAddressSync(params.mint, params.seller)
  const tokenVault = getAssociatedTokenAddressSync(params.mint, vaultAuthority, true)

  const data = concat(IX.sell, encodeU64(params.tokensIn), encodeU64(params.minSolOut))

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.seller, isSigner: true, isWritable: true },
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: tokenVault, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
}

export function buildGraduateInstruction(params: { authority: PublicKey; mint: PublicKey }) {
  const programId = getWeb4ProgramId()
  if (!programId) throw new Error('NEXT_PUBLIC_WEB4_PROGRAM_ID is not set')

  const [pool] = poolPda(params.mint)
  const [vaultAuthority] = vaultAuthorityPda(params.mint)
  const tokenVault = getAssociatedTokenAddressSync(params.mint, vaultAuthority, true)

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: tokenVault, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: IX.graduate,
  })
}

/** Ensure buyer/seller ATA exists before trade. */
export function maybeCreateAtaIx(owner: PublicKey, mint: PublicKey, payer: PublicKey) {
  const ata = getAssociatedTokenAddressSync(mint, owner)
  return createAssociatedTokenAccountInstruction(payer, ata, owner, mint)
}
