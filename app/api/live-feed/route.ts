import { NextRequest, NextResponse } from 'next/server'
import { buildHeliusApiUrl } from '@/lib/helius-server'
import { withFullAccessApiAuth } from '@/lib/middleware/with-api-auth'
import { scanApiErrorPayload } from '@/lib/api/scan-api-errors'

export const dynamic = 'force-dynamic'

export const GET = withFullAccessApiAuth(async (_req: NextRequest) => {
  try {
    // Get recent transactions from top Solana tokens
    const mints = [
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p',   // WIF
      'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUAi9oA',   // MEW
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
    ]

    const results = await Promise.allSettled(
      mints.slice(0, 2).map(mint =>
        fetch(buildHeliusApiUrl(`/addresses/${mint}/transactions`, { limit: 5 }))
          .then(r => r.json())
          .then(txs => ({ mint, txs: Array.isArray(txs) ? txs : [] }))
      )
    )

    const events: Array<{tag:string; cls:string; text:string; mint:string}> = []

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { mint, txs } = result.value

      for (const tx of txs.slice(0, 3)) {
        const sym = tx.tokenTransfers?.[0]?.symbol || 
                    (mint === 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' ? 'BONK' : 
                     mint === 'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p' ? 'WIF' : 'TOKEN')
        
        const amount = tx.tokenTransfers?.[0]?.tokenAmount || 0
        const from   = tx.feePayer?.slice(0, 4) + '…' + tx.feePayer?.slice(-4)
        const type   = tx.type || 'TRANSFER'

        if (type === 'SWAP' || tx.tokenTransfers?.length > 0) {
          const usdAmt = tx.tokenTransfers?.[0]?.tokenAmount || 0
          if (usdAmt > 1000) {
            events.push({
              tag: 'WHALE',
              cls: 'bg-amber-950/40 text-amber-400 border border-amber-800/30',
              text: `Smart wallet ${from} bought ${Math.floor(usdAmt).toLocaleString()} ${sym}`,
              mint,
            })
          } else {
            events.push({
              tag: 'SWAP',
              cls: 'bg-blue-950/40 text-blue-400 border border-blue-800/30',
              text: `${from} swapped ${Math.floor(usdAmt).toLocaleString()} ${sym}`,
              mint,
            })
          }
        } else if (type === 'TRANSFER') {
          events.push({
            tag: 'TX',
            cls: 'bg-slate-950/40 text-slate-400 border border-slate-800/30',
            text: `Transfer detected on ${sym} from ${from}`,
            mint,
          })
        }
      }
    }

    // Get real mint events
    const mintCheck = await fetch(
      buildHeliusApiUrl('/addresses/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/transactions', {
        limit: 3,
        type: 'MINT_TO',
      })
    ).then(r => r.json()).catch(() => [])

    if (Array.isArray(mintCheck) && mintCheck.length > 0) {
      events.push({
        tag: 'MINT',
        cls: 'bg-orange-950/40 text-orange-400 border border-orange-800/30',
        text: `Mint event on BONK — exercise caution`,
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      })
    }

    return NextResponse.json({ 
      success: true, 
      events: events.slice(0, 10),
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('[live-feed]', err)
    return NextResponse.json(
      scanApiErrorPayload('Upstream intelligence sources unavailable', 502, 'UPSTREAM_ERROR', {
        reason: 'UPSTREAM_ERROR',
        severity: 'high',
      }),
      { status: 502 }
    )
  }
})
