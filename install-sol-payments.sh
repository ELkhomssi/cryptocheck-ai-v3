#!/bin/bash
set -e
echo "🔧 Installing Solana Payment System..."

# ═══ 1. API Routes ═══
echo "📝 Creating API routes..."

mkdir -p app/api/payments/verify
cp /dev/stdin app/api/payments/verify/route.ts << 'ENDVERIFY'
import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { createClient } from '@supabase/supabase-js'

const TREASURY = '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i'
const RPC = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com'
const PLANS: Record<string,{credits:number;isPro:boolean;isElite:boolean;label:string;minUsd:number}> = {
  starter:{credits:10,isPro:false,isElite:false,label:'Micro Pack',minUsd:5},
  pro:{credits:-1,isPro:true,isElite:false,label:'Pro Trader',minUsd:30},
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

    return NextResponse.json({success:true,plan:pc.label,credits:pc.credits>0?upd.credits:'unlimited',isPro:pc.isPro,isElite:pc.isElite})
  } catch(e:any) {
    console.error('[PAYMENT]',e)
    return NextResponse.json({error:e?.message||'Failed'},{status:500})
  }
}
ENDVERIFY
echo "   ✅ app/api/payments/verify/route.ts"

mkdir -p app/api/sol-price
cat > app/api/sol-price/route.ts << 'ENDPRICE'
import { NextResponse } from 'next/server'
export async function GET() {
  try {
    const res = await fetch('https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112',{next:{revalidate:30}})
    const data = await res.json()
    const price = data?.data?.So11111111111111111111111111111111111111112?.price
    if (!price) {
      const cg = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',{next:{revalidate:60}})
      const cgd = await cg.json()
      return NextResponse.json({price:cgd?.solana?.usd||80,source:'coingecko'})
    }
    return NextResponse.json({price,source:'jupiter'})
  } catch { return NextResponse.json({price:80,source:'fallback'}) }
}
ENDPRICE
echo "   ✅ app/api/sol-price/route.ts"

# ═══ 2. Patch ProModal to use SOL payments ═══
echo ""
echo "📝 Patching ProModal for SOL payments..."

node << 'ENDOFSCRIPT'
const fs = require('fs');
let d = fs.readFileSync('app/dashboard.tsx', 'utf8');
let changes = [];

// Replace the handleBuy function with SOL payment logic
const oldHandleBuy = `  async function handleBuy(planId: string) {
    setLoading(planId)
    try {
      if (planId === 'whale') {
        window.open('mailto:elkhomsiabderrahim@gmail.com?subject=Whale Plan Application', '_blank')
        setLoading(null); return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ plan: planId === 'starter' ? 'starter' : planId === 'elite' ? (billing === 'monthly' ? 'elite' : 'elite_yearly') : billing === 'monthly' ? 'pro' : 'yearly' })
      })
      const data = await res.json()
      if (data.url) window.location.assign(data.url)
      else throw new Error(data.error || 'Failed')
    } catch(e) {
      alert('Payment error: ' + (e instanceof Error ? e.message : 'Unknown'))
    } finally { setLoading(null) }
  }`;

const newHandleBuy = `  const [solPrice, setSolPrice] = React.useState(80)
  const [txStatus, setTxStatus] = React.useState<string|null>(null)

  React.useEffect(() => {
    fetch('/api/sol-price').then(r=>r.json()).then(d=>{ if(d.price) setSolPrice(d.price) }).catch(()=>{})
  }, [])

  async function handleBuy(planId: string) {
    setLoading(planId)
    setTxStatus(null)
    try {
      if (planId === 'whale') {
        window.open('mailto:elkhomsiabderrahim@gmail.com?subject=Whale Plan Application', '_blank')
        setLoading(null); return
      }

      // Get wallet from Solana adapter
      const walletEl = document.querySelector('[data-wallet-adapter]') as any
      const { solana } = window as any
      let provider = (window as any).phantom?.solana || (window as any).solana
      if (!provider?.isPhantom && !provider?.publicKey) {
        alert('Please connect your Phantom or Solana wallet first')
        setLoading(null); return
      }

      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import('@solana/web3.js')
      const connection = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed')

      // Calculate SOL amount
      const plan = planId === 'starter' ? 'starter' : planId === 'elite' ? (billing === 'monthly' ? 'elite' : 'elite_yearly') : billing === 'monthly' ? 'pro' : 'yearly'
      const usdPrices: Record<string,number> = { starter:5, pro:30, yearly:288, elite:40, elite_yearly:384 }
      const usdAmount = usdPrices[plan] || 30
      const solAmount = usdAmount / solPrice

      setTxStatus('Requesting wallet approval...')

      const fromPubkey = provider.publicKey
      const toPubkey = new PublicKey('5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i')

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.round(solAmount * LAMPORTS_PER_SOL),
        })
      )

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = fromPubkey

      setTxStatus('Confirm in wallet...')
      const signed = await provider.signTransaction(transaction)
      
      setTxStatus('Sending transaction...')
      const signature = await connection.sendRawTransaction(signed.serialize())
      
      setTxStatus('Confirming on-chain...')
      await connection.confirmTransaction(signature, 'confirmed')

      setTxStatus('Verifying payment...')
      // Get user ID from auth
      const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('Not logged in')

      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, plan, userId, solPrice }),
      })
      const result = await verifyRes.json()

      if (!verifyRes.ok) throw new Error(result.error || 'Verification failed')

      setTxStatus('✅ Payment confirmed!')
      setTimeout(() => window.location.reload(), 1500)

    } catch(e: any) {
      const msg = e?.message || 'Unknown error'
      if (msg.includes('User rejected')) {
        setTxStatus('Transaction cancelled')
      } else {
        setTxStatus('❌ ' + msg)
      }
    } finally {
      setTimeout(() => setLoading(null), 2000)
    }
  }`;

if (d.includes(oldHandleBuy)) {
  d = d.replace(oldHandleBuy, newHandleBuy);
  changes.push('handleBuy: replaced Stripe with SOL payment');
} else {
  console.log('⚠️  Could not find exact handleBuy — trying partial match');
  if (d.includes("async function handleBuy(planId: string)")) {
    // Find start and end of function
    const start = d.indexOf("async function handleBuy(planId: string)");
    let braceCount = 0, end = start;
    let inFunc = false;
    for (let i = start; i < d.length; i++) {
      if (d[i] === '{') { braceCount++; inFunc = true; }
      if (d[i] === '}') { braceCount--; }
      if (inFunc && braceCount === 0) { end = i + 1; break; }
    }
    d = d.slice(0, start) + newHandleBuy + d.slice(end);
    changes.push('handleBuy: replaced (partial match)');
  }
}

// Add SOL price display to each plan card
const oldPrice = "pl.price === 0 ? 'FREE' : `$${pl.price}`";
const newPrice = "pl.price === 0 ? 'FREE' : `$${pl.price}`";
// Add SOL equivalent below the price
const oldPeriod = "<div style={{fontSize:10,color:'#6e7681',marginBottom:8}}>{pl.period}</div>";
const newPeriod = `<div style={{fontSize:10,color:'#6e7681',marginBottom:2}}>{pl.period}</div>
              {pl.price > 0 && <div style={{fontSize:9,color:'#484f58',marginBottom:6,fontFamily:"'IBM Plex Mono',monospace"}}>≈ {(pl.price / solPrice).toFixed(3)} SOL</div>}`;

if (d.includes(oldPeriod)) {
  d = d.replace(oldPeriod, newPeriod);
  changes.push('Plan cards: show SOL equivalent');
}

// Add txStatus display above the plans grid
const oldChoose = "<div style={{padding:'12px 20px 6px',fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:'#6e7681',textTransform:'uppercase'}}>Choose a plan</div>";
const newChoose = `{txStatus && <div style={{margin:'0 14px 8px',padding:'8px 12px',borderRadius:6,fontSize:11,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace",background:txStatus.includes('✅')?'rgba(0,255,136,0.06)':txStatus.includes('❌')?'rgba(255,68,68,0.06)':'rgba(212,175,55,0.06)',border:txStatus.includes('✅')?'1px solid rgba(0,255,136,0.15)':txStatus.includes('❌')?'1px solid rgba(255,68,68,0.15)':'1px solid rgba(212,175,55,0.15)',color:txStatus.includes('✅')?'#00ff88':txStatus.includes('❌')?'#ff4444':'#d4af37'}}>{txStatus}</div>}
        <div style={{padding:'12px 20px 6px',fontSize:10,fontWeight:700,letterSpacing:'0.1em',color:'#6e7681',textTransform:'uppercase'}}>Choose a plan</div>`;

if (d.includes(oldChoose)) {
  d = d.replace(oldChoose, newChoose);
  changes.push('Modal: transaction status display');
}

fs.writeFileSync('app/dashboard.tsx', d);
console.log('');
changes.forEach(c => console.log('✅ ' + c));
ENDOFSCRIPT

# ═══ 3. Supabase Migration ═══
echo ""
echo "📝 Creating Supabase migration..."
cat > supabase-payments-migration.sql << 'ENDSQL'
-- ============================================================
-- CryptoCheck AI — Subscriptions & Payment Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Add is_elite to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_elite BOOLEAN DEFAULT false;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  plan_label TEXT,
  amount_sol NUMERIC,
  amount_usd NUMERIC,
  tx_signature TEXT UNIQUE,
  from_wallet TEXT,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own subs" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Index for duplicate check
CREATE INDEX IF NOT EXISTS idx_sub_tx ON subscriptions(tx_signature);
CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);

SELECT 'Payment schema ready!' AS status;
ENDSQL
echo "   ✅ supabase-payments-migration.sql"

# ═══ 4. Verify ═══
echo ""
echo "🔍 TypeScript check..."
npx tsc --noEmit 2>&1 | head -10

echo ""
echo "============================================"
echo "✅ SOLANA PAYMENT SYSTEM INSTALLED"
echo ""
echo "Components:"
echo "  • /api/payments/verify — On-chain tx verification + Supabase update"
echo "  • /api/sol-price — Live SOL/USD price (Jupiter + CoinGecko fallback)"
echo "  • ProModal — SOL wallet payment with live status"
echo ""
echo "Flow:"
echo "  1. User clicks plan → fetches SOL price"
echo "  2. Calculates SOL amount from USD price"
echo "  3. Triggers wallet transfer to 5jbW...x15i"
echo "  4. Verifies on-chain (parsed instructions)"
echo "  5. Records in subscriptions table"
echo "  6. Updates profile (credits/isPro/isElite)"
echo ""
echo "⚠️  Run in Supabase SQL Editor:"
echo "   cat supabase-payments-migration.sql | pbcopy"
echo ""
echo "🚀 Deploy:"
echo "   git add -A && git commit -m 'feat: SOL payment system with on-chain verification' && vercel --prod"
echo "============================================"
