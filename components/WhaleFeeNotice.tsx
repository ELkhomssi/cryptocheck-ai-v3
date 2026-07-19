'use client'

export default function WhaleFeeNotice({ onClose }: { onClose?: () => void }) {
  return (
    <div style={{
      background:'linear-gradient(135deg,rgba(0,212,130,0.06),rgba(0,0,0,0))',
      border:'1px solid rgba(0,212,130,0.2)',
      borderRadius:8,padding:'14px 16px',
      fontFamily:'IBM Plex Mono,monospace',
      position:'relative'
    }}>
      {onClose && (
        <button onClick={onClose} style={{position:'absolute',top:8,right:10,background:'none',border:'none',color:'#6e7681',cursor:'pointer',fontSize:14}}>×</button>
      )}

      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <span style={{fontSize:18}}>🐋</span>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'#00d4aa',letterSpacing:'0.08em'}}>WHALE PLAN — PLATFORM FEE</div>
          <div style={{fontSize:9,color:'#6e7681',marginTop:1}}>Transparent 0.50% platform fee · shown before every trade</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        {[
          { label:'Monthly Cost',   val:'$0',   color:'#00d4aa', sub:'Always free' },
          { label:'Platform Fee',   val:'0.50%', color:'#d4af37', sub:'Shown before every trade' },
          { label:'Min Trade Size', val:'$500', color:'#e2e8f0', sub:'Per transaction' },
          { label:'Route',         val:'Jupiter',color:'#e2e8f0', sub:'On-chain · non-custodial' },
        ].map(s => (
          <div key={s.label} style={{background:'rgba(0,0,0,0.3)',border:'1px solid #1f2937',borderRadius:6,padding:'8px 10px'}}>
            <div style={{fontSize:8,color:'#6e7681',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:3}}>{s.label}</div>
            <div style={{fontSize:16,fontWeight:700,color:s.color,fontFamily:'IBM Plex Mono,monospace'}}>{s.val}</div>
            <div style={{fontSize:8,color:'#484f58',marginTop:2}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{fontSize:9,color:'#6e7681',lineHeight:1.6,borderTop:'1px solid #1f2937',paddingTop:10}}>
        <div style={{color:'#00d4aa',fontWeight:700,marginBottom:4}}>HOW IT WORKS:</div>
        <div>1. Connect your dedicated trading wallet</div>
        <div>2. AI auto-sniper builds risk-gated Jupiter swaps</div>
        <div>3. Transparent 0.50% platform fee shown as a line item before you confirm</div>
        <div>4. Fee routes on-chain via Jupiter — your wallet signs</div>
      </div>

      <button
        onClick={() => window.open('mailto:elkhomsiabderrahim@gmail.com?subject=Whale Plan Application', '_blank')}
        style={{
          width:'100%',marginTop:12,padding:'9px 0',
          background:'linear-gradient(135deg,#00d4aa,#059669)',
          border:'none',borderRadius:6,
          color:'#0a0a0a',fontSize:11,fontWeight:700,
          cursor:'pointer',letterSpacing:'0.06em',
          boxShadow:'0 0 14px rgba(0,212,130,0.25)'
        }}>
        🐋 APPLY FOR WHALE ACCESS
      </button>
    </div>
  )
}
