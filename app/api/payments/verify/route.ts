import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { createClient } from '@supabase/supabase-js'

const TREASURY = '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i'
const RPC = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com'
const PLANS: Record<string,{credits:number;isPro:boolean;isElite:boolean;label:string;minUsd:number}> = {
  starter:{credits:10,isPro:false,isElite:false,label:'Micro Pack',minUsd:5},
  deep:{credits:-1,isPro:true,isElite:false,label:'Pro Max Deep',minUsd:30},
  pro_yearly:{credits:-1,isPro:true,isElite:false,label:'Pro Yearly',minUsd:288},
  whale:{credits:-1,isPro:true,isElite:false,label:'Whale Access',minUsd:0},
  elite:{credits:-1,isPro:true,isElite:true,label:'Pro Max Elite',minUsd:40},
  elite_yearly:{credits:-1,isPro:true,isElite:true,label:'Elite Yearly',minUsd:384},
}

export async function POST(req: NextRequest) {
  try {
    const { signature, plan, userId, solPrice } = await req.json()
    if (!signature || !plan || !userId) return NextResponse.json({error:'Missing params'},{status:400})
    const pc = PLANS[plan]
    if (!pc) return NextResponse.json({error:'Invalid plan'},{status:400})

    const conn = new Connection(RPC, 'confirmed')
    let tx: any = null
    for (let i = 0; i < 3; i++) {
      tx = await conn.getParsedTransaction(signature, {maxSupportedTransactionVersion:0})
      if (tx) break
      await new Promise(r => setTimeout(r, 2000))
    }
    if (!tx?.meta || tx.meta.err) return NextResponse.json({error:'Transaction not found or failed'},{status:400})

    let amount = 0, from = ''
    for (const ix of tx.transaction.message.instructions) {
      if ('parsed' in ix && ix.parsed?.type === 'transfer' && ix.parsed.info?.destination === TREASURY) {
        amount = ix.parsed.info.lamports / LAMPORTS_PER_SOL
        from = ix.parsed.info.source
        break
      }
    }
    if (amount === 0) {
      const keys = tx.transaction.message.accountKeys
      const ti = keys.findIndex((k:any) => k.pubkey.toString() === TREASURY)
      if (ti >= 0) {
        const diff = (tx.meta.postBalances[ti] - tx.meta.preBalances[ti]) / LAMPORTS_PER_SOL
        if (diff > 0) { amount = diff; from = keys[0].pubkey.toString() }
      }
    }
    if (amount === 0) return NextResponse.json({error:'No transfer to treasury'},{status:400})

    const expected = pc.minUsd / (solPrice || 80)
    if (amount < expected * 0.95 && pc.minUsd > 0) return NextResponse.json({error:`Insufficient: expected ~${expected.toFixed(4)} SOL, got ${amount.toFixed(4)}`},{status:402})

    const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: dup } = await svc.from('subscriptions').select('id').eq('tx_signature', signature).single()
    if (dup) return NextResponse.json({error:'Already processed'},{status:409})

    await svc.from('subscriptions').insert({
      user_id:userId, plan, plan_label:pc.label, amount_sol:amount, amount_usd:amount*(solPrice||80),
      tx_signature:signature, from_wallet:from, status:'active', started_at:new Date().toISOString(),
      expires_at:new Date(Date.now()+(plan.includes('yearly')?365:30)*86400000).toISOString(),
    })

    const upd: Record<string,any> = {}
    if (pc.credits > 0) {
      const { data: p } = await svc.from('profiles').select('credits').eq('id',userId).single()
      upd.credits = (p?.credits||0) + pc.credits
      await svc.from('credit_transactions').insert({user_id:userId,amount:pc.credits,reason:`purchase_${plan}`,balance_after:upd.credits})
    }
    if (pc.isPro) { upd.is_pro = true; upd.plan = plan }
    if (pc.isElite) upd.is_elite = true
    if (Object.keys(upd).length) await svc.from('profiles').update(upd).eq('id',userId)

    // Process referral commission
    const { data: payerProfile } = await svc.from('profiles').select('referred_by').eq('id', userId).single()
    if (payerProfile?.referred_by) {
      const { data: referrer } = await svc.from('profiles').select('id, referral_earnings_sol').eq('referral_code', payerProfile.referred_by).single()
      if (referrer && pc.minUsd > 0) {
        const commissionRate = 0.20
        const commissionSol = amount * commissionRate
        const commissionUsd = commissionSol * (solPrice || 80)
        await svc.from('commissions').insert({
          referrer_id: referrer.id,
          referred_id: userId,
          plan: plan,
          tx_signature: signature,
          amount_sol: amount,
          amount_usd: amount * (solPrice || 80),
          commission_rate: commissionRate,
          commission_sol: commissionSol,
          commission_usd: commissionUsd,
          status: 'pending',
        })
        await svc.from('profiles').update({
          referral_earnings_sol: (referrer.referral_earnings_sol || 0) + commissionSol,
        }).eq('id', referrer.id)
      }
    }

    return NextResponse.json({success:true,plan:pc.label,credits:pc.credits>0?upd.credits:'unlimited',isPro:pc.isPro,isElite:pc.isElite})
  } catch(e:any) {
    console.error('[PAYMENT]',e)
    return NextResponse.json({error:e?.message||'Failed'},{status:500})
  }
}
