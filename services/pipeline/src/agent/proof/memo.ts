/**
 * Solana Memo program writer — MVP on-chain commitment.
 * Live broadcast only when SIGNAL_AGENT_PROOF_LIVE=true and SIGNAL_AGENT_SOLANA_SECRET is set.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { memoFromCommitmentHash } from './commitment.js'

/** SPL Memo program. */
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

function loadKeypair(): Keypair | null {
  const raw = process.env.SIGNAL_AGENT_SOLANA_SECRET?.trim()
  if (!raw) return null
  try {
    const arr = JSON.parse(raw) as number[]
    if (!Array.isArray(arr) || arr.length < 32) throw new Error('expected JSON byte array')
    return Keypair.fromSecretKey(Uint8Array.from(arr))
  } catch (e) {
    console.warn('[proof/memo] invalid SIGNAL_AGENT_SOLANA_SECRET', e instanceof Error ? e.message : e)
    return null
  }
}

function rpcUrl(): string {
  return (
    process.env.SIGNAL_AGENT_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  )
}

export function clusterFromRpc(url: string): string | undefined {
  if (url.includes('devnet')) return 'devnet'
  if (url.includes('testnet')) return 'testnet'
  return undefined
}

export type MemoWriteResult = {
  txSignature: string
  agentPubkey: string
  cluster?: string
}

/**
 * Write commitment hash to Solana Memo. Returns null when live keypair unavailable
 * (caller falls back to paper commitment).
 */
export async function writeMemoCommitment(commitmentHash: string): Promise<MemoWriteResult | null> {
  if (process.env.SIGNAL_AGENT_PROOF_LIVE?.trim() !== 'true') return null

  const payer = loadKeypair()
  if (!payer) return null

  const connection = new Connection(rpcUrl(), 'confirmed')
  const memo = memoFromCommitmentHash(commitmentHash)
  const ix = new TransactionInstruction({
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, 'utf8'),
  })

  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
  })

  return {
    txSignature: sig,
    agentPubkey: payer.publicKey.toBase58(),
    cluster: clusterFromRpc(rpcUrl()),
  }
}

/** Read memo strings from a confirmed transaction (for verify on-chain match). */
export async function readMemosFromTx(txSignature: string): Promise<string[]> {
  if (txSignature.startsWith('paper:')) return []

  const connection = new Connection(rpcUrl(), 'confirmed')
  const tx = await connection.getParsedTransaction(txSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })
  if (!tx?.transaction?.message?.instructions) return []

  const memos: string[] = []
  for (const ix of tx.transaction.message.instructions) {
    if ('parsed' in ix) {
      const parsed = ix.parsed as { type?: string; info?: string } | string
      if (typeof parsed === 'string') memos.push(parsed)
      else if (parsed && typeof parsed.info === 'string') memos.push(parsed.info)
      continue
    }
    if ('programId' in ix && 'data' in ix) {
      const programId = String((ix as { programId: PublicKey | string }).programId)
      if (programId === MEMO_PROGRAM_ID.toBase58()) {
        try {
          memos.push(Buffer.from(String((ix as { data: string }).data), 'base64').toString('utf8'))
        } catch {
          /* skip */
        }
      }
    }
  }
  return memos
}
