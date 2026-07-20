'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { dashToast } from './DashToast'
import type { PlatformFeeDisclosure } from '@/lib/launchpad/platform-fee'

type PendingPayload = {
  pending: {
    id: string
    mint: string
    swapTxBase64: string
    walletAddress: string
    platformFeeDisclosure: PlatformFeeDisclosure
    createdAt: string
  }
  compliance: string
  feeDisclosurePath: string
}

export function GuardianExitPrompt({ pendingId }: { pendingId: string }) {
  const wallet = useWallet()
  const { connection } = useConnection()
  const [data, setData] = useState<PendingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txSig, setTxSig] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/guardian/pending-exit?id=${encodeURIComponent(pendingId)}`, {
          cache: 'no-store',
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Pending exit not found')
        if (!cancelled) setData(body as PendingPayload)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pendingId])

  const signExit = useCallback(async () => {
    if (!data?.pending.swapTxBase64 || !wallet.publicKey || !wallet.signTransaction) {
      setError('Connect the authorized wallet to sign this exit.')
      return
    }
    if (wallet.publicKey.toBase58() !== data.pending.walletAddress) {
      setError('Connected wallet does not match the authorized Guardian wallet.')
      return
    }

    setSigning(true)
    setError(null)
    try {
      const tx = VersionedTransaction.deserialize(Buffer.from(data.pending.swapTxBase64, 'base64'))
      const signed = await wallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 2,
      })
      await connection.confirmTransaction(sig, 'confirmed')

      const confirmRes = await fetch('/api/guardian/confirm-exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId: data.pending.id, txSignature: sig }),
      })
      const confirmBody = await confirmRes.json()
      if (!confirmRes.ok) throw new Error(confirmBody.error ?? 'Confirm failed')

      setTxSig(sig)
      dashToast('Guardian auto-exit signed and submitted')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign failed'
      setError(msg)
    } finally {
      setSigning(false)
    }
  }, [connection, data, wallet, pendingId])

  if (loading) {
    return (
      <p className="rounded-dash-chip border border-dash-innerline px-3 py-2 text-[11px] text-dash-tmid">
        Loading Guardian exit…
      </p>
    )
  }

  if (error && !data) {
    return (
      <p className="rounded-dash-chip border border-dash-red/40 bg-dash-red/10 px-3 py-2 text-[11px] text-dash-red">
        {error}
      </p>
    )
  }

  if (!data) return null

  const fee = data.pending.platformFeeDisclosure

  return (
    <div className="rounded-dash-chip border border-dash-gold/40 bg-dash-gold/10 px-3 py-3 space-y-2">
      <p className="text-[12px] font-semibold text-dash-gold">Guardian Auto-Exit · sign required</p>
      <p className="text-[11px] text-dash-thi">
        DANGER detected on a held position. Review the pre-built sell tx — your wallet signs; we never
        hold keys.
      </p>
      {fee.configured ? (
        <p className="font-dash-mono text-[10px] text-dash-tmid">
          Platform fee: {fee.feeBps} bps ({fee.feeAmountHuman || fee.feeAmount}) ·{' '}
          <Link href={data.feeDisclosurePath} className="underline">
            fee disclosure
          </Link>
        </p>
      ) : null}
      <p className="text-[10px] text-dash-tlo">{data.compliance}</p>
      {txSig ? (
        <p className="font-dash-mono text-[10px] text-dash-green">
          Submitted:{' '}
          <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noreferrer" className="underline">
            {txSig.slice(0, 16)}…
          </a>
        </p>
      ) : (
        <button
          type="button"
          disabled={signing}
          onClick={() => void signExit()}
          className="rounded-dash-chip bg-dash-green px-3 py-1.5 text-[10px] font-bold uppercase text-dash-bg disabled:opacity-50"
        >
          {signing ? 'Signing…' : 'Sign exit in wallet'}
        </button>
      )}
      {error ? <p className="text-[10px] text-dash-red">{error}</p> : null}
    </div>
  )
}
