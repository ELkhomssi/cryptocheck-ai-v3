import { NextResponse } from 'next/server'

const HELIUS_KEY = process.env.HELIUS_KEY || '8948de2b-6114-45cd-839d-1a81eb273cd9'

export async function GET() {
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
        fetch(`https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${HELIUS_KEY}&limit=5`)
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
      `https://api.helius.xyz/v0/addresses/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/transactions?api-key=${HELIUS_KEY}&limit=3&type=MINT_TO`
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
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
