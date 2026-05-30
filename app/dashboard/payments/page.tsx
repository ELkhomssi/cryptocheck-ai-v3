'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'
import { Copy, Wallet, Check } from 'lucide-react'

type MerchantPaymentRow = {
  id: string
  fromWallet: string
  amountUsd: number
  tokenMint: string
  status: string
  riskScore: number | null
  signature: string | null
  at: string
}

const TOKEN_LABEL: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
}

export default function MerchantPaymentsPage() {
  const { walletAddress, isConnected, connect, shortAddr } = useSolana()
  const [registered, setRegistered] = useState<boolean | null>(null)
  const [merchantName, setMerchantName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [payments, setPayments] = useState<MerchantPaymentRow[]>([])
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const payUrl = walletAddress ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${walletAddress}` : ''

  const refresh = useCallback(async () => {
    if (!walletAddress) return
    try {
      const [mRes, pRes] = await Promise.all([
        fetch(`/api/payments/merchant?wallet=${walletAddress}`),
        fetch(`/api/payments/merchant/payments?wallet=${walletAddress}`),
      ])
      const m = (await mRes.json().catch(() => ({}))) as { registered?: boolean; merchantName?: string }
      const p = (await pRes.json().catch(() => ({}))) as { payments?: MerchantPaymentRow[] }
      setRegistered(Boolean(m.registered))
      if (m.merchantName) setMerchantName(m.merchantName)
      setPayments(Array.isArray(p.payments) ? p.payments : [])
    } catch {
      /* ignore */
    }
  }, [walletAddress])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const register = useCallback(async () => {
    if (!walletAddress || !merchantName.trim()) return
    setSaving(true)
    try {
      await fetch('/api/payments/merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, merchantName: merchantName.trim(), webhookUrl: webhookUrl.trim() || undefined, chain: 'solana' }),
      })
      await refresh()
    } finally {
      setSaving(false)
    }
  }, [walletAddress, merchantName, webhookUrl, refresh])

  const stats = useMemo(() => {
    const confirmed = payments.filter((p) => p.status === 'confirmed')
    const total = confirmed.reduce((a, p) => a + (Number(p.amountUsd) || 0), 0)
    const flagged = payments.filter((p) => (p.riskScore ?? 0) >= 40 && (p.riskScore ?? 0) < 80).length
    const blocked = payments.filter((p) => (p.riskScore ?? 0) >= 80).length
    const clean = payments.length - flagged - blocked
    return { total, count: confirmed.length, flagged, blocked, clean }
  }, [payments])

  const copyLink = useCallback(() => {
    if (!payUrl) return
    void navigator.clipboard.writeText(payUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [payUrl])

  if (!isConnected) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold text-white">Merchant payments</h1>
        <p className="text-sm text-slate-400">Connect your wallet to view payments and your payment link.</p>
        <button onClick={() => void connect()} className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-5 py-3 text-sm font-semibold text-slate-950">
          <Wallet className="h-4 w-4" /> Connect wallet
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-slate-100">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Merchant payments</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{shortAddr}</p>
        </div>
      </header>

      {registered === false ? (
        <section className="space-y-3 rounded-2xl border border-cyan-500/25 bg-slate-950/70 p-5">
          <p className="text-sm font-semibold text-cyan-200">Register to receive payments</p>
          <input value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Merchant name" className="w-full rounded-xl border border-white/10 bg-[#020617] px-3.5 py-2.5 text-sm outline-none focus:border-[#00d4aa]/45" />
          <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="Webhook URL (optional)" className="w-full rounded-xl border border-white/10 bg-[#020617] px-3.5 py-2.5 text-sm outline-none focus:border-[#00d4aa]/45" />
          <button onClick={() => void register()} disabled={saving || !merchantName.trim()} className="rounded-xl bg-[#00d4aa] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {saving ? 'Saving…' : 'Register merchant'}
          </button>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Received (confirmed)" value={`$${stats.total.toFixed(2)}`} />
        <Stat label="Payments" value={String(stats.count)} />
        <Stat label="Flagged" value={String(stats.flagged)} tone="amber" />
        <Stat label="Blocked" value={String(stats.blocked)} tone="rose" />
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-200">Your payment link</p>
          <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 break-all font-mono text-xs text-[#00d4aa]">{payUrl}</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p className="mb-3 text-sm font-semibold text-slate-200">Recent payments</p>
        {payments.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3">From</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Token</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Risk</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/[0.06]">
                    <td className="py-2 pr-3 font-mono">{p.fromWallet.slice(0, 4)}…{p.fromWallet.slice(-4)}</td>
                    <td className="py-2 pr-3">${Number(p.amountUsd).toFixed(2)}</td>
                    <td className="py-2 pr-3">{TOKEN_LABEL[p.tokenMint] ?? p.tokenMint.slice(0, 4)}</td>
                    <td className="py-2 pr-3">{p.status}</td>
                    <td className={`py-2 pr-3 ${(p.riskScore ?? 0) >= 80 ? 'text-rose-300' : (p.riskScore ?? 0) >= 40 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {p.riskScore ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'rose' }) {
  const color = tone === 'amber' ? 'text-amber-300' : tone === 'rose' ? 'text-rose-300' : 'text-white'
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3">
      <p className="text-[0.6rem] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
