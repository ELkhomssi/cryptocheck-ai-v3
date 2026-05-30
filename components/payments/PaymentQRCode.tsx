'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import { buildPaymentLink, type PaymentLinkParams } from '@/lib/payments/payment-link'

type Props = {
  wallet: string
  amountUsd?: number
  token?: PaymentLinkParams['token']
  memo?: string
  chain?: string
  size?: number
}

export function PaymentQRCode({ wallet, amountUsd, token, memo, chain, size = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!wallet) return
    const link = buildPaymentLink({ wallet, amountUsd, token, memo, chain })
    setUrl(link)
    const canvas = canvasRef.current
    if (!canvas) return
    QRCode.toCanvas(canvas, link, { width: size, margin: 1, color: { dark: '#020617', light: '#ffffff' } }).catch(
      (e: unknown) => setErr(e instanceof Error ? e.message : 'QR render failed')
    )
  }, [wallet, amountUsd, token, memo, chain, size])

  const download = useCallback(async () => {
    if (!url) return
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `ccai-pay-${wallet.slice(0, 6)}.png`
      a.click()
    } catch {
      /* ignore */
    }
  }, [url, wallet])

  const shortUrl = url.replace(/^https?:\/\//, '')

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl bg-white p-3">
        <canvas ref={canvasRef} aria-label="Payment QR code" />
      </div>
      {err ? <p className="text-xs text-rose-300">{err}</p> : null}
      <p className="text-center text-xs text-slate-400">Scan to pay with CryptoCheck AI</p>
      {shortUrl ? <p className="max-w-[260px] break-all text-center font-mono text-[0.65rem] text-slate-500">{shortUrl}</p> : null}
      <button
        onClick={() => void download()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
      >
        <Download className="h-3.5 w-3.5" /> Download PNG
      </button>
    </div>
  )
}
