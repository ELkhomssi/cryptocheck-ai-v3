'use client'

/**
 * Phase 18 — after wallet connect, request SIWS signature and establish session.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

export type SiwsStatus = 'idle' | 'challenging' | 'signing' | 'verifying' | 'ready' | 'error'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

export function useSiwsSession() {
  const { publicKey, signMessage, connected, disconnect } = useWallet()
  const [status, setStatus] = useState<SiwsStatus>('idle')
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastWallet = useRef<string | null>(null)
  const inFlight = useRef(false)

  const refreshMe = useCallback(async () => {
    const res = await fetch('/api/auth/siws/me', { cache: 'no-store' })
    const body = (await res.json()) as {
      authenticated?: boolean
      userId?: string
    }
    if (body.authenticated && body.userId) {
      setUserId(body.userId)
      setStatus('ready')
      return true
    }
    setUserId(null)
    return false
  }, [])

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError('Wallet cannot sign messages')
      setStatus('error')
      return false
    }
    if (inFlight.current) return false
    inFlight.current = true
    const wallet = publicKey.toBase58()
    setError(null)
    setStatus('challenging')
    try {
      const chRes = await fetch('/api/auth/siws/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      })
      const challenge = (await chRes.json()) as {
        nonce?: string
        message?: string
        error?: string
      }
      if (!chRes.ok || !challenge.nonce || !challenge.message) {
        throw new Error(challenge.error || 'Challenge failed')
      }

      setStatus('signing')
      const encoded = new TextEncoder().encode(challenge.message)
      const sig = await signMessage(encoded)
      const signatureBase64 = bytesToBase64(sig)

      setStatus('verifying')
      const vRes = await fetch('/api/auth/siws/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          nonce: challenge.nonce,
          message: challenge.message,
          signatureBase64,
        }),
      })
      const verified = (await vRes.json()) as { ok?: boolean; userId?: string; error?: string }
      if (!vRes.ok || !verified.ok || !verified.userId) {
        throw new Error(verified.error || 'Verify failed')
      }
      setUserId(verified.userId)
      setStatus('ready')
      lastWallet.current = wallet
      return true
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      return false
    } finally {
      inFlight.current = false
    }
  }, [publicKey, signMessage])

  const signOut = useCallback(async () => {
    await fetch('/api/auth/siws/logout', { method: 'POST' })
    setUserId(null)
    setStatus('idle')
    lastWallet.current = null
    try {
      await disconnect()
    } catch {
      /* ignore */
    }
  }, [disconnect])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  useEffect(() => {
    if (!connected || !publicKey) return
    const wallet = publicKey.toBase58()
    if (lastWallet.current === wallet && status === 'ready') return
    if (inFlight.current) return
    void (async () => {
      const already = await refreshMe()
      if (already) {
        lastWallet.current = wallet
        return
      }
      await signIn()
    })()
  }, [connected, publicKey, refreshMe, signIn, status])

  return {
    status,
    userId,
    error,
    signIn,
    signOut,
    authenticated: status === 'ready' && Boolean(userId),
  }
}
