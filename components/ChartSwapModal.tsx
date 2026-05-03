'use client'
import { useState } from 'react'
import { copyToClipboard } from '@/lib/utils'
import { JupiterTerminalEmbed } from '@/components/JupiterTerminalEmbed'

interface ChartSwapModalProps {
  mint: string
  symbol: string
  onClose: () => void
  initialTab?: 'chart' | 'swap'
}

export default function ChartSwapModal({ mint, symbol, onClose, initialTab }: ChartSwapModalProps) {
  const [tab, setTab] = useState<'chart'|'swap'>(initialTab || 'chart')
  const [copied, setCopied] = useState(false)
  // Copy mint address
  async function handleCopy() {
    const ok = await copyToClipboard(mint)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  const dexUrl = `https://dexscreener.com/solana/${mint}?embed=1&theme=dark&trades=0&info=0`

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:9500,
      background:'rgba(2,4,14,0.92)', backdropFilter:'blur(16px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'IBM Plex Mono,monospace',
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:'min(900px,95vw)', height:'min(620px,90vh)',
        background:'linear-gradient(160deg,#060919 0%,#09102a 100%)',
        border:'1px solid rgba(91,95,239,0.22)', borderRadius:12,
        display:'flex', flexDirection:'column', overflow:'hidden',
        boxShadow:'0 32px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Top accent */}
        <div style={{height:1, background:'linear-gradient(90deg,transparent,#5b5fef,#0ea5e9,transparent)', flexShrink:0}}/>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.05)',flexShrink:0}}>
          <div style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,fontWeight:700,color:'#eef2f8',letterSpacing:'0.08em'}}>${symbol}</span>
            <span style={{fontSize:9,color:'#5a6478',fontFamily:'monospace'}}>{mint.slice(0,8)}…{mint.slice(-6)}</span>
            <button onClick={handleCopy} style={{background:copied?'rgba(16,185,129,0.15)':'rgba(255,255,255,0.05)',border:`1px solid ${copied?'rgba(16,185,129,0.3)':'rgba(255,255,255,0.1)'}`,borderRadius:4,padding:'2px 8px',fontSize:8,color:copied?'#10b981':'#8892a4',cursor:'pointer',fontFamily:'IBM Plex Mono,monospace',fontWeight:700,transition:'all 0.2s'}}>
              {copied ? '✓ COPIED' : '⎘ COPY'}
            </button>
          </div>
          {/* Tabs */}
          <div style={{display:'flex',gap:4}}>
            {(['chart','swap'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:'4px 12px',borderRadius:4,fontSize:9,fontWeight:700,cursor:'pointer',border:'none',fontFamily:'IBM Plex Mono,monospace',letterSpacing:'0.06em',background:tab===t?'rgba(91,95,239,0.2)':'transparent',color:tab===t?'#8b85f8':'#5a6478',transition:'all 0.2s'}}>
                {t === 'chart' ? '📈 CHART' : '⚡ SWAP'}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:18,lineHeight:1,padding:'0 4px'}}>×</button>
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:'hidden',position:'relative'}}>
          {/* Chart */}
          <div style={{position:'absolute',inset:0,display:tab==='chart'?'block':'none'}}>
            <iframe
              src={dexUrl}
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              style={{width:'100%',height:'100%',border:0,background:'#030308',display:'block'}}
            />
          </div>
          {/* Swap — Jupiter Terminal (in-page) */}
          <div style={{ position: 'absolute', inset: 0, display: tab === 'swap' ? 'block' : 'none', overflow: 'auto', background: '#0d0f1a' }}>
            <JupiterTerminalEmbed mint={mint} minHeight={480} />
          </div>
        </div>
      </div>
    </div>
  )
}
