'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'

const TOKENS = {
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9, native: true },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, native: false },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, native: false },
} as const

type TokenKey = keyof typeof TOKENS

type PaymentIntent = {
  id: string
  status: string
  riskAssessment?: {
    score: number
    recipientVerified: boolean
    approved: boolean
    blockedReason?: string
    amountRiskFlag?: boolean
  }
}

type Props = {
  wallet: string
  merchantName?: string | null
  embed?: boolean
  defaultAmountUsd?: number
  defaultToken?: TokenKey
  memo?: string
}

async function fetchSolPriceUsd(): Promise<number> {
  try {
    const res = await fetch('/api/sol-price', { cache: 'no-store' })
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const p = Number(j.price ?? j.usd ?? j.solUsd)
    return Number.isFinite(p) && p > 0 ? p : 150
  } catch {
    return 150
  }
}

export function PayWidget({ wallet, merchantName, embed = false, defaultAmountUsd, defaultToken = 'USDC', memo }: Props) {
  const { connection } = useConnection()
  const { publicKey, signTransaction } = useWallet()
  const { setVisible } = useWalletModal()

  const [amountUsd, setAmountUsd] = useState(defaultAmountUsd ? String(defaultAmountUsd) : '')
  const [token, setToken] = useState<TokenKey>(defaultToken)
  const [phase, setPhase] = useState<'idle' | 'checking' | 'signing' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [risk, setRisk] = useState<PaymentIntent['riskAssessment'] | null>(null)

  const shortWallet = `${wallet.slice(0, 4)}…${wallet.slice(-4)}`

  const pay = useCallback(async () => {
    setError(null)
    setSignature(null)
    const usd = Number(amountUsd)
    if (!Number.isFinite(usd) || usd <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (!publicKey || !signTransaction) {
      setVisible(true)
      return
    }

    const cfg = TOKENS[token]
    try {
      // 1. Create risk-checked intent.
      setPhase('checking')
      const intentRes = await fetch('/api/payments/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toWallet: wallet,
          tokenMint: cfg.mint,
          amountUsd: usd,
          chain: 'solana',
          fromWallet: publicKey.toBase58(),
          memo,
        }),
      })
      const intent = (await intentRes.json().catch(() => ({}))) as PaymentIntent & { error?: string }
      if (!intentRes.ok) {
        setPhase('error')
        setError(intent.error || 'Could not create payment.')
        return
      }
      setRisk(intent.riskAssessment ?? null)
      if (intent.status === 'risk_blocked' || intent.riskAssessment?.approved === false) {
        const blockReason = intent.riskAssessment?.blockedReason || 'Payment blocked by risk policy.'
        if (embed && typeof window !== 'undefined' && window.parent !== window) {
          window.parent.postMessage({ type: 'ccai-pay:risk-block', reason: blockReason }, '*')
        }
        setPhase('error')
        setError(blockReason)
        return
      }

      // 2. Build transfer transaction.
      const toPk = new PublicKey(wallet)
      const tx = new Transaction()
      if (cfg.native) {
        const solPrice = await fetchSolPriceUsd()
        const lamports = Math.round((usd / solPrice) * 1e9)
        tx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: toPk, lamports }))
      } else {
        const mintPk = new PublicKey(cfg.mint)
        const units = Math.round(usd * 10 ** cfg.decimals)
        const fromAta = await getAssociatedTokenAddress(mintPk, publicKey)
        const toAta = await getAssociatedTokenAddress(mintPk, toPk)
        tx.add(createTransferInstruction(fromAta, toAta, publicKey, units))
      }
      tx.feePayer = publicKey
      const { blockhash } = await connection.getLatestBlockhash('confirmed')
      tx.recentBlockhash = blockhash

      // 3. Sign + submit via confirm route.
      setPhase('signing')
      const signed = await signTransaction(tx)
      const b64 = Buffer.from(signed.serialize()).toString('base64')

      setPhase('submitting')
      const confirmRes = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: intent.id, signedTransaction: b64 }),
      })
      const conf = (await confirmRes.json().catch(() => ({}))) as { signature?: string; status?: string; error?: string }
      if (!confirmRes.ok || conf.status === 'failed') {
        const failMsg = conf.error || 'Payment failed on-chain.'
        if (embed && typeof window !== 'undefined' && window.parent !== window) {
          window.parent.postMessage({ type: 'ccai-pay:error', message: failMsg }, '*')
        }
        setPhase('error')
        setError(failMsg)
        return
      }
      setSignature(conf.signature ?? null)
      setPhase('done')
      if (embed && typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage(
          { type: 'ccai-pay:success', signature: conf.signature ?? '', intentId: intent.id },
          '*'
        )
      }
    } catch (e) {
      const failMsg = e instanceof Error ? e.message : 'Payment failed.'
      if (embed && typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage({ type: 'ccai-pay:error', message: failMsg }, '*')
      }
      setPhase('error')
      setError(failMsg)
    }
  }, [amountUsd, token, publicKey, signTransaction, setVisible, wallet, memo, connection])

  const busy = phase === 'checking' || phase === 'signing' || phase === 'submitting'

  return (
    <div className={`${embed ? 'w-[320px]' : 'w-full max-w-md'} space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-5 text-slate-100`}>
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#00d4aa]">Pay with CryptoCheck AI</p>
        <p className="mt-1 text-sm font-semibold">{merchantName || shortWallet}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
          {risk?.recipientVerified ? (
            <><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Risk verified recipient</>
          ) : (
            <><ShieldAlert className="h-3.5 w-3.5 text-amber-400" /> Recipient verified at payment time</>
          )}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="number"
          min={0}
          value={amountUsd}
          onChange={(e) => setAmountUsd(e.target.value)}
          placeholder="Amount (USD)"
          className="w-full rounded-xl border border-white/10 bg-[#020617] px-3.5 py-2.5 text-sm outline-none focus:border-[#00d4aa]/45 focus:ring-2 focus:ring-[#00d4aa]/20"
        />
        <div className="flex gap-2">
          {(Object.keys(TOKENS) as TokenKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setToken(k)}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                token === k ? 'border-[#00d4aa]/50 bg-[#00d4aa]/10 text-[#00d4aa]' : 'border-white/10 text-slate-400'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p> : null}

      {phase === 'done' && signature ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
          <p className="text-sm font-semibold text-emerald-200">Payment sent securely</p>
          <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer" className="block break-all text-xs text-[#00d4aa] underline">
            {signature.slice(0, 12)}…
          </a>
        </div>
      ) : (
        <button
          onClick={() => void pay()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4aa] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : null}
          {phase === 'checking' ? 'Risk checking…' : phase === 'signing' ? 'Sign in wallet…' : phase === 'submitting' ? 'Submitting…' : !publicKey ? 'Connect wallet & pay' : 'Pay now'}
        </button>
      )}

      <p className="text-center text-[0.6rem] text-slate-600">Powered by CryptoCheck AI · risk-verified payments</p>
    </div>
  )
}
