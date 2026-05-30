'use client'

import { useMemo, useState, useCallback } from 'react'
import { useSolana } from '@/components/SolanaProvider'
import { Copy, Check, Wallet } from 'lucide-react'
import { PaymentQRCode } from '@/components/payments/PaymentQRCode'
import { buildPaymentLink, buildEmbedCode, type PaymentLinkParams } from '@/lib/payments/payment-link'

type TokenKey = NonNullable<PaymentLinkParams['token']>

export default function PaymentLinkPage() {
  const { walletAddress, isConnected, connect, shortAddr } = useSolana()

  const [amountMode, setAmountMode] = useState<'fixed' | 'customer'>('customer')
  const [amountUsd, setAmountUsd] = useState('25')
  const [token, setToken] = useState<TokenKey>('USDC')
  const [memo, setMemo] = useState('')
  const [copied, setCopied] = useState<'url' | 'embed' | null>(null)

  const params = useMemo<PaymentLinkParams>(
    () => ({
      wallet: walletAddress ?? '',
      amountUsd: amountMode === 'fixed' && Number(amountUsd) > 0 ? Number(amountUsd) : undefined,
      token,
      memo: memo.trim() || undefined,
    }),
    [walletAddress, amountMode, amountUsd, token, memo]
  )

  const link = useMemo(() => (walletAddress ? buildPaymentLink(params) : ''), [walletAddress, params])
  const embed = useMemo(() => (walletAddress ? buildEmbedCode(params) : ''), [walletAddress, params])

  const copy = useCallback((text: string, which: 'url' | 'embed') => {
    void navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  if (!isConnected || !walletAddress) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold text-white">Payment link</h1>
        <p className="text-sm text-slate-400">Connect your wallet to create a payment link.</p>
        <button onClick={() => void connect()} className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-5 py-3 text-sm font-semibold text-slate-950">
          <Wallet className="h-4 w-4" /> Connect wallet
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-slate-100">
      <header className="border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-white">Payment link</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">{shortAddr}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <div>
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Amount</p>
            <div className="flex gap-2">
              <button onClick={() => setAmountMode('customer')} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${amountMode === 'customer' ? 'border-[#00d4aa]/50 bg-[#00d4aa]/10 text-[#00d4aa]' : 'border-white/10 text-slate-400'}`}>
                Customer enters
              </button>
              <button onClick={() => setAmountMode('fixed')} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${amountMode === 'fixed' ? 'border-[#00d4aa]/50 bg-[#00d4aa]/10 text-[#00d4aa]' : 'border-white/10 text-slate-400'}`}>
                Fixed amount
              </button>
            </div>
            {amountMode === 'fixed' ? (
              <input type="number" min={0} value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} placeholder="USD" className="mt-2 w-full rounded-xl border border-white/10 bg-[#020617] px-3.5 py-2.5 text-sm outline-none focus:border-[#00d4aa]/45" />
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Token</p>
            <div className="flex gap-2">
              {(['SOL', 'USDC', 'USDT'] as TokenKey[]).map((k) => (
                <button key={k} onClick={() => setToken(k)} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${token === k ? 'border-[#00d4aa]/50 bg-[#00d4aa]/10 text-[#00d4aa]' : 'border-white/10 text-slate-400'}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Memo (optional)</p>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="invoice-123" className="w-full rounded-xl border border-white/10 bg-[#020617] px-3.5 py-2.5 text-sm outline-none focus:border-[#00d4aa]/45" />
          </div>

          <p className="text-[0.6rem] leading-relaxed text-slate-600">
            Payment intents always expire 15 minutes after creation for security. Link-level expiry is a display preference only.
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <PaymentQRCode wallet={walletAddress} amountUsd={params.amountUsd} token={token} memo={params.memo} />

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">Shareable URL</p>
              <button onClick={() => copy(link, 'url')} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                {copied === 'url' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </button>
            </div>
            <p className="mt-1 break-all font-mono text-[0.65rem] text-[#00d4aa]">{link}</p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-300">Embed code</p>
              <button onClick={() => copy(embed, 'embed')} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                {copied === 'embed' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </button>
            </div>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-white/10 bg-[#020617] p-3 font-mono text-[0.6rem] text-slate-400">{embed}</pre>
          </div>
        </section>
      </div>
    </main>
  )
}
