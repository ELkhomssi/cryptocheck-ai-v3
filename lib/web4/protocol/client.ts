import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import { quoteBuyToken, quoteSellToken } from '@/lib/web4/bonding-curve/adapter'
import { solToLamports, tokensToBase } from '@/lib/web4/bonding-curve/math'
import type { BondingToken } from '@/app/dashboard/web4-terminal/pump-curve'
import { isWeb4ProgramConfigured } from './config'
import { reportProtocolEvent } from './index-client'
import {
  buildBuyInstruction,
  buildGraduateInstruction,
  buildInitializePoolInstructions,
  buildSellInstruction,
  maybeCreateAtaIx,
} from './instructions'
import { waitForSignature } from './confirmation'
import type { TxLifecycle } from './types'

export type SendTxOptions = {
  connection: Connection
  wallet: WalletContextState
  onLifecycle?: (state: TxLifecycle) => void
}

async function signAndSend(
  connection: Connection,
  wallet: WalletContextState,
  tx: Transaction,
  signers: Keypair[] = [],
  onLifecycle?: (state: TxLifecycle) => void,
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected')
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = wallet.publicKey
  if (signers.length) tx.partialSign(...signers)

  const signed = await wallet.signTransaction(tx)
  onLifecycle?.({ phase: 'signed', signature: null })

  const raw = signed.serialize()
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  })

  onLifecycle?.({ phase: 'sent', signature })

  await waitForSignature(connection, signature, onLifecycle, blockhash, lastValidBlockHeight)

  return signature
}

export async function createPoolOnChain(
  opts: SendTxOptions & {
    name: string
    symbol: string
    description: string
    initialBuySol: number
  },
): Promise<{ mint: string; signature: string }> {
  if (!isWeb4ProgramConfigured()) {
    throw new Error('Web4 program not configured. Set NEXT_PUBLIC_WEB4_PROGRAM_ID.')
  }

  const mintKeypair = Keypair.generate()
  const { instructions } = buildInitializePoolInstructions({
    payer: opts.wallet.publicKey!,
    mintKeypair,
    name: opts.name,
    symbol: opts.symbol,
    uri: `https://web4.fun/coin/${mintKeypair.publicKey.toBase58()}`,
    initialBuySol: opts.initialBuySol,
  })

  const tx = new Transaction().add(...instructions)

  if (opts.initialBuySol > 0.01) {
    const { instructions: buyIxs } = buildBuyInstruction({
      buyer: opts.wallet.publicKey!,
      mint: mintKeypair.publicKey,
      solIn: opts.initialBuySol,
      minTokensOut: 0n,
    })
    tx.add(maybeCreateAtaIx(opts.wallet.publicKey!, mintKeypair.publicKey, opts.wallet.publicKey!))
    tx.add(...buyIxs)
  }

  const signature = await signAndSend(
    opts.connection,
    opts.wallet,
    tx,
    [mintKeypair],
    opts.onLifecycle,
  )

  void reportProtocolEvent({
    type: 'deploy',
    wallet: opts.wallet.publicKey?.toBase58(),
  })
  if (opts.initialBuySol > 0) {
    void reportProtocolEvent({
      type: 'trade',
      lamports: solToLamports(opts.initialBuySol),
      wallet: opts.wallet.publicKey?.toBase58(),
    })
  }

  return { mint: mintKeypair.publicKey.toBase58(), signature }
}

export async function buyOnChain(
  opts: SendTxOptions & { token: BondingToken; solIn: number; slippageBps?: number },
): Promise<string> {
  const mint = new PublicKey(opts.token.mint)
  const expected = quoteBuyToken(opts.token, opts.solIn)
  const minOut = tokensToBase(expected * (1 - (opts.slippageBps ?? 100) / 10_000))

  const { instructions } = buildBuyInstruction({
    buyer: opts.wallet.publicKey!,
    mint,
    solIn: opts.solIn,
    minTokensOut: minOut,
  })

  const tx = new Transaction()
  tx.add(maybeCreateAtaIx(opts.wallet.publicKey!, mint, opts.wallet.publicKey!))
  tx.add(...instructions)

  const sig = await signAndSend(opts.connection, opts.wallet, tx, [], opts.onLifecycle)
  void reportProtocolEvent({
    type: 'trade',
    lamports: solToLamports(opts.solIn),
    wallet: opts.wallet.publicKey?.toBase58(),
  })
  return sig
}

export async function sellOnChain(
  opts: SendTxOptions & { token: BondingToken; tokenIn: number; slippageBps?: number },
): Promise<string> {
  const mint = new PublicKey(opts.token.mint)
  const expected = quoteSellToken(opts.token, opts.tokenIn)
  const minOut = solToLamports(expected * (1 - (opts.slippageBps ?? 100) / 10_000))

  const ix = buildSellInstruction({
    seller: opts.wallet.publicKey!,
    mint,
    tokensIn: tokensToBase(opts.tokenIn),
    minSolOut: minOut,
  })

  const tx = new Transaction().add(ix)
  const sig = await signAndSend(opts.connection, opts.wallet, tx, [], opts.onLifecycle)
  void reportProtocolEvent({
    type: 'trade',
    wallet: opts.wallet.publicKey?.toBase58(),
  })
  return sig
}

export async function graduatePoolOnChain(
  opts: SendTxOptions & { mint: string },
): Promise<string> {
  const mint = new PublicKey(opts.mint)
  const ix = buildGraduateInstruction({
    authority: opts.wallet.publicKey!,
    mint,
  })
  const tx = new Transaction().add(ix)
  const sig = await signAndSend(opts.connection, opts.wallet, tx, [], opts.onLifecycle)
  void reportProtocolEvent({ type: 'graduate', wallet: opts.wallet.publicKey?.toBase58() })
  return sig
}
