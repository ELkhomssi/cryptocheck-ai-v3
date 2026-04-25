import { NextRequest, NextResponse } from 'next/server'
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { createServerClient } from '@supabase/ssr'
import { getClientSolanaRpcUrl, PLATFORM_WALLET } from '@/lib/helius'
import { upsertSaasSubscription } from '@/lib/services/saas-subscription.service'
import { getUserSubscription } from '@/lib/services/user-subscription.service'

const PLAN_PRO_DEVELOPER = 'pro-developer'
const PRO_DEVELOPER_USD = 29
const DEFAULT_SOL_PRICE = 100

type VerifyDeveloperBody = {
  signature?: string
  tier?: string
  solPrice?: number
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll() {},
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as VerifyDeveloperBody
    const signature = typeof body.signature === 'string' ? body.signature : ''
    const tier = typeof body.tier === 'string' ? body.tier : ''
    const solPrice = typeof body.solPrice === 'number' && Number.isFinite(body.solPrice) ? body.solPrice : DEFAULT_SOL_PRICE

    if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    if (tier !== PLAN_PRO_DEVELOPER) return NextResponse.json({ error: 'Unsupported tier' }, { status: 400 })

    const conn = new Connection(getClientSolanaRpcUrl(), 'confirmed')
    let tx: Awaited<ReturnType<Connection['getParsedTransaction']>> | null = null
    for (let i = 0; i < 3; i += 1) {
      tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 })
      if (tx) break
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    if (!tx?.meta || tx.meta.err) {
      return NextResponse.json({ error: 'Transaction not found or failed' }, { status: 400 })
    }

    let amountSol = 0
    let fromWallet = ''

    for (const ix of tx.transaction.message.instructions) {
      if ('parsed' in ix && ix.parsed?.type === 'transfer' && ix.parsed.info?.destination === PLATFORM_WALLET) {
        amountSol = ix.parsed.info.lamports / LAMPORTS_PER_SOL
        fromWallet = ix.parsed.info.source
        break
      }
    }

    if (amountSol === 0) {
      const keys = tx.transaction.message.accountKeys
      const treasuryIndex = keys.findIndex((k) => k.pubkey.toString() === PLATFORM_WALLET)
      if (treasuryIndex >= 0) {
        const diff = (tx.meta.postBalances[treasuryIndex] - tx.meta.preBalances[treasuryIndex]) / LAMPORTS_PER_SOL
        if (diff > 0) {
          amountSol = diff
          fromWallet = keys[0]?.pubkey.toString() ?? ''
        }
      }
    }

    if (amountSol === 0) {
      return NextResponse.json({ error: 'No SOL transfer to treasury wallet' }, { status: 400 })
    }

    const expectedSol = PRO_DEVELOPER_USD / solPrice
    if (amountSol < expectedSol * 0.95) {
      return NextResponse.json(
        { error: `Insufficient amount: expected ~${expectedSol.toFixed(4)} SOL, got ${amountSol.toFixed(4)} SOL` },
        { status: 402 }
      )
    }

    const current = await getUserSubscription(user.id)
    const previousStripeCustomerId = current.record?.stripe_customer_id ?? null
    const previousStripeSubscriptionId = current.record?.stripe_subscription_id ?? null

    await upsertSaasSubscription({
      userId: user.id,
      tier: 'PRO',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      stripeCustomerId: previousStripeCustomerId,
      stripeSubscriptionId: previousStripeSubscriptionId,
    })

    return NextResponse.json({
      success: true,
      tier: 'PRO',
      plan: PLAN_PRO_DEVELOPER,
      signature,
      amountSol,
      amountUsd: amountSol * solPrice,
      fromWallet,
    })
  } catch (error) {
    console.error('[payments/verify-developer]', error)
    return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
  }
}
