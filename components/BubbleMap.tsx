'use client'
import { useEffect, useRef, useState } from 'react'

interface Token {
  symbol: string
  change: number
  volume: number
  mint: string
}

const TOKENS: Token[] = [
  { symbol: 'BONK', change: 12.3, volume: 2400000, mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'WIF',  change: -2.1, volume: 1800000, mint: 'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p' },
  { symbol: 'MEW',  change: 8.7,  volume: 900000,  mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUAi9oA' },
  { symbol: 'JUP',  change: 6.7,  volume: 3200000, mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'PYTH', change: -5.3, volume: 700000,  mint: 'HZ1JovNiVvGqNLQLjJe1yohSWhe58gorEHPHYNGrSWjk' },
  { symbol: 'RAY',  change: 3.2,  volume: 500000,  mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { symbol: 'POPCAT', change: 15.4, volume: 1100000, mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdCBuHYmW2hr' },
  { symbol: 'BOME', change: -8.9, volume: 600000,  mint: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82' },
]

export default function BubbleMap({ onSelectToken }: { onSelectToken?: (mint: string, symbol: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const animRef = useRef<number>(0)
  const bubblesRef = useRef<Array<{x:number;y:number;vx:number;vy:number;r:number;token:Token}>>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight

    // Initialize bubbles
    bubblesRef.current = TOKENS.map((token, i) => {
      const r = Math.max(30, Math.min(60, Math.abs(token.change) * 3 + Math.sqrt(token.volume) / 800))
      return {
        x: Math.random() * (W - r * 2) + r,
        y: Math.random() * (H - r * 2) + r,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r, token
      }
    })

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, W, H)

      // Draw grid
      ctx.strokeStyle = 'rgba(0,212,130,0.04)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

      const bubbles = bubblesRef.current
      
      // Update positions
      bubbles.forEach(b => {
        b.x += b.vx; b.y += b.vy
        if (b.x - b.r < 0 || b.x + b.r > W) b.vx *= -1
        if (b.y - b.r < 0 || b.y + b.r > H) b.vy *= -1
      })

      // Draw bubbles
      bubbles.forEach(b => {
        const isPos = b.token.change > 0
        const isSelected = selected === b.token.mint
        const color = isPos ? '#00d4aa' : '#ff4444'
        const alpha = 0.15 + Math.abs(b.token.change) / 100

        // Glow
        const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        grd.addColorStop(0, isPos ? `rgba(0,212,130,${alpha + 0.1})` : `rgba(255,68,68,${alpha + 0.1})`)
        grd.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = grd; ctx.fill()

        // Border
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.strokeStyle = isSelected ? '#fff' : color
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.stroke()

        // Symbol
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.max(10, b.r * 0.35)}px IBM Plex Mono,monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(b.token.symbol, b.x, b.y - 6)

        // Change %
        ctx.fillStyle = color
        ctx.font = `${Math.max(9, b.r * 0.28)}px IBM Plex Mono,monospace`
        ctx.fillText(`${b.token.change > 0 ? '+' : ''}${b.token.change}%`, b.x, b.y + 10)
      })

      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    // Click handler
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      bubblesRef.current.forEach(b => {
        const dist = Math.sqrt((mx - b.x) ** 2 + (my - b.y) ** 2)
        if (dist < b.r) {
          setSelected(b.token.mint)
          onSelectToken?.(b.token.mint, b.token.symbol)
        }
      })
    }
    canvas.addEventListener('click', handleClick)

    return () => {
      cancelAnimationFrame(animRef.current)
      canvas.removeEventListener('click', handleClick)
    }
  }, [])

  return (
    <div style={{position:'relative',width:'100%',height:'100%',background:'#0d1117',borderRadius:8,overflow:'hidden',border:'1px solid rgba(0,212,130,0.1)'}}>
      <div style={{position:'absolute',top:8,left:12,fontSize:'9px',fontWeight:700,letterSpacing:'0.1em',color:'#6e7681',fontFamily:'IBM Plex Mono,monospace',zIndex:2}}>
        🫧 LIVE BUBBLE MAP · SOLANA TOKENS
      </div>
      <div style={{position:'absolute',top:8,right:12,display:'flex',gap:8,fontSize:'8px',fontFamily:'IBM Plex Mono,monospace',zIndex:2}}>
        <span style={{color:'#00d4aa'}}>● BULLISH</span>
        <span style={{color:'#ff4444'}}>● BEARISH</span>
      </div>
      <canvas ref={canvasRef} style={{width:'100%',height:'100%',cursor:'pointer'}} />
    </div>
  )
}
