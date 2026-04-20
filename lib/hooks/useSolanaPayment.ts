'use client'

import { useCallback, useEffect, useState } from 'react'
import { getClientSolanaRpcUrl, PLATFORM_WALLET } from '@/lib/helius'
import { formatSolanaError } from '@/lib/payments/format-solana-error'

type SolanaPayResult = {
  ok: boolean
  message: string
}

type UseSolanaPaymentOptions = {
  onSuccess?: () => void
}

type SolanaPayTier = 'pro-developer'

const TIER_USD_PRICE: Record<SolanaPayTier, number> = {
  'pro-developer': 29,
}

export function useSolanaPayment(options?: UseSolanaPaymentOptions) {
  const [loadingTierId, setLoadingTierId] = useState<SolanaPayTier | null>(null)
  const [loadingMethod, setLoadingMethod] = useState<'sol' | 'usdc' | null>(null)
  const [solPrice, setSolPrice] = useState(100)

  useEffect(() => {
    void fetch('/api/sol-price')
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.price === 'number' && Number.isFinite(j.price) && j.price > 0) {
          setSolPrice(j.price)
        }
      })
      .catch(() => {})
  }, [])

  const handleSolPay = useCallback(
    async (tierId: SolanaPayTier): Promise<SolanaPayResult> => {
      setLoadingTierId(tierId)
      setLoadingMethod('sol')

      let connection: import('@solana/web3.js').Connection | null = null
      let payerPubkey: import('@solana/web3.js').PublicKey | null = null
      let requiredLamports: number | undefined

      try {
        const provider = (window as { phantom?: { solana?: unknown }; solana?: unknown }).phantom?.solana || (window as { solana?: unknown }).solana
        const signer = provider as {
          publicKey?: import('@solana/web3.js').PublicKey
          signTransaction?: (tx: import('@solana/web3.js').Transaction) => Promise<import('@solana/web3.js').Transaction>
        }

        if (!signer?.publicKey || !signer.signTransaction) {
          return { ok: false, message: 'Connect your Phantom wallet first.' }
        }

        payerPubkey = signer.publicKey
        const web3 = await import('@solana/web3.js')

        connection = new web3.Connection(getClientSolanaRpcUrl(), 'confirmed')
        const usdPrice = TIER_USD_PRICE[tierId]
        const solAmount = usdPrice / solPrice
        requiredLamports = Math.round(solAmount * web3.LAMPORTS_PER_SOL)

        const tx = new web3.Transaction()
        tx.add(
          web3.SystemProgram.transfer({
            fromPubkey: signer.publicKey,
            toPubkey: new web3.PublicKey(PLATFORM_WALLET),
            lamports: requiredLamports,
          })
        )
        tx.add(
          new web3.TransactionInstruction({
            keys: [],
            programId: new web3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
            data: Buffer.from(`CryptoCheck AI Developer ${tierId}`, 'utf8'),
          })
        )

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')
        tx.recentBlockhash = blockhash
        tx.feePayer = signer.publicKey

        const signed = await signer.signTransaction(tx)
        const signature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        })

        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')

        const verifyRes = await fetch('/api/payments/verify-developer', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature,
            tier: tierId,
            solPrice,
          }),
        })
        const verifyJson = await verifyRes.json().catch(() => ({}))
        if (!verifyRes.ok) {
          throw new Error(typeof verifyJson.error === 'string' ? verifyJson.error : 'Verification failed')
        }

        options?.onSuccess?.()
        return { ok: true, message: 'Payment confirmed. Pro Developer tier is now active.' }
      } catch (error) {
        let userLamports: number | undefined
        if (connection && payerPubkey) {
          try {
            userLamports = await connection.getBalance(payerPubkey)
          } catch {
            /* ignore follow-up RPC balance failures */
          }
        }

        return {
          ok: false,
          message: formatSolanaError(error, { requiredLamports, userLamports }),
        }
      } finally {
        setLoadingTierId(null)
        setLoadingMethod(null)
      }
    },
    [options, solPrice]
  )

  const handleUsdcPay = useCallback(async (): Promise<SolanaPayResult> => {
    return { ok: false, message: 'USDC checkout is not wired yet for Developer billing.' }
  }, [])

  return {
    loadingTierId,
    loadingMethod,
    solPrice,
    handleSolPay,
    handleUsdcPay,
  }
}
