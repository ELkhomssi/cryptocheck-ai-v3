'use client'

import { useEffect, useId, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { getClientSolanaRpcUrl } from '@/lib/helius'

/** Wrapped SOL / native SOL mint used by Jupiter for SOL-side swaps. */
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112'

const JUPITER_SCRIPT_SRC = 'https://terminal.jup.ag/main-v2.js'

type JupiterInitOpts = {
  displayMode: 'integrated'
  integratedTargetId: string
  endpoint: string
  enableWalletPassthrough?: boolean
  formProps?: {
    initialInputMint?: string
    initialOutputMint?: string
    fixedOutputMint?: boolean
  }
}

type JupiterGlobal = {
  init: (opts: JupiterInitOpts) => void
  close?: () => void
  syncProps?: (opts: { passthroughWalletContextState?: unknown }) => void
}

function getJupiter(): JupiterGlobal | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { Jupiter?: JupiterGlobal }).Jupiter
}

let scriptPromise: Promise<void> | null = null

function loadJupiterTerminalScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (getJupiter()?.init) return Promise.resolve()

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${JUPITER_SCRIPT_SRC}"]`)
      if (existing) {
        if (getJupiter()?.init) {
          resolve()
          return
        }
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('Jupiter script failed')), { once: true })
        return
      }
      const s = document.createElement('script')
      s.src = JUPITER_SCRIPT_SRC
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Jupiter script failed'))
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

export type JupiterTerminalEmbedProps = {
  /** Output mint (token to buy with SOL). */
  mint: string
  /** When true, tear down Terminal (e.g. modal swap opened elsewhere). */
  suspend?: boolean
  className?: string
  minHeight?: number
}

/**
 * In-page Jupiter swap via official Terminal (script), not jup.ag iframe
 * (jup.ag blocks third-party iframes). Requires root `SolanaProvider` for passthrough wallet.
 */
export function JupiterTerminalEmbed({ mint, suspend, className, minHeight = 400 }: JupiterTerminalEmbedProps) {
  const reactId = useId().replace(/:/g, '')
  const containerId = `jup-term-${reactId}`
  const wallet = useWallet()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (suspend) {
      getJupiter()?.close?.()
      return
    }

    let cancelled = false
    setFailed(false)

    void (async () => {
      try {
        await loadJupiterTerminalScript()
        if (cancelled) return
        const J = getJupiter()
        if (!J?.init) {
          setFailed(true)
          return
        }
        J.close?.()
        if (cancelled) return

        J.init({
          displayMode: 'integrated',
          integratedTargetId: containerId,
          endpoint: getClientSolanaRpcUrl(),
          enableWalletPassthrough: true,
          formProps: {
            initialInputMint: NATIVE_SOL_MINT,
            initialOutputMint: mint,
            fixedOutputMint: true,
          },
        })
        J.syncProps?.({ passthroughWalletContextState: wallet })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      getJupiter()?.close?.()
    }
  }, [mint, suspend, containerId, wallet])

  useEffect(() => {
    if (suspend) return
    const J = getJupiter()
    if (!J?.syncProps) return
    J.syncProps({ passthroughWalletContextState: wallet })
  }, [suspend, wallet.connected, wallet.connecting, wallet.disconnecting, wallet.publicKey, wallet.wallet, wallet])

  if (suspend) {
    return (
      <div
        className={className}
        style={{
          minHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: '#0a0a16',
          color: '#8b949e',
          fontSize: 12,
          textAlign: 'center',
        }}
      >
        Le swap est ouvert dans la fenêtre — fermez-la pour revenir au terminal ici.
      </div>
    )
  }

  const jupFallback = `https://jup.ag/swap/SOL-${encodeURIComponent(mint)}`

  return (
    <div className={className} style={{ minHeight, position: 'relative', background: '#0a0a16' }}>
      {failed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 16,
            background: 'rgba(10,10,22,0.92)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 12, color: '#fca5a5', margin: 0 }}>Impossible de charger le terminal Jupiter.</p>
          <a
            href={jupFallback}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#6ee7b7',
              textDecoration: 'underline',
            }}
          >
            Ouvrir jup.ag ↗
          </a>
        </div>
      )}
      <div id={containerId} style={{ width: '100%', minHeight, minWidth: 0 }} />
    </div>
  )
}
