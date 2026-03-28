'use client'
import { useState, useEffect } from 'react'

interface WhaleWallet {
  address: string
  label: string
  pnl: string
  pnlRaw: number
  trades: number
  winRate: number
  isInsider: boolean
  insiderScore: number
  lastAction: string
  lastToken: string
  lastTime: string
  tags: string[]
  recentBuys: { token: string; amount: string; minutesBefore: number }[]
}

const INSIDER_WALLETS: WhaleWallet[] = [
  {
    address: '7xKP…8gQw', label: 'Whale Alpha #1',
    pnl: '+$284K', pnlRaw: 284000, trades: 847, winRate: 78,
    isInsider: true, insiderScore: 94,
    lastAction: 'BUY', lastToken: 'MEW', lastTime: '2m ago',
    tags: ['INSIDER', 'WHALE', 'ALPHA'],
    recentBuys: [
      { token: 'BONK', amount: '180 SOL', minutesBefore: 2 },
      { token: 'WIF',  amount: '95 SOL',  minutesBefore: 4 },
      { token: 'MEW',  amount: '220 SOL', minutesBefore: 1 },
    ]
  },
  {
    address: '3nRT…4mPL', label: 'Smart Money #1',
    pnl: '+$91K', pnlRaw: 91000, trades: 412, winRate: 71,
    isInsider: true, insiderScore: 87,
    lastAction: 'BUY', lastToken: 'POPCAT', lastTime: '5m ago',
    tags: ['INSIDER', 'SMART'],
    recentBuys: [
      { token: 'POPCAT', amount: '75 SOL', minutesBefore: 3 },
      { token: 'BONK',   amount: '50 SOL', minutesBefore: 5 },
    ]
  },
  {
    address: 'DeFi…9hWs', label: 'DeFi Degen',
    pnl: '+$38K', pnlRaw: 38000, trades: 1204, winRate: 58,
    isInsider: false, insiderScore: 42,
    lastAction: 'SELL', lastToken: 'BOME', lastTime: '12m ago',
    tags: ['DEGEN', 'ALPHA'],
    recentBuys: [
      { token: 'BOME', amount: '30 SOL', minutesBefore: 8 },
    ]
  },
  {
    address: 'BotA…3kRf', label: 'Sniper Bot Elite',
    pnl: '+$156K', pnlRaw: 156000, trades: 5891, winRate: 82,
    isInsider: true, insiderScore: 96,
    lastAction: 'BUY', lastToken: 'WIF', lastTime: '1m ago',
    tags: ['INSIDER', 'BOT', 'SNIPER'],
    recentBuys: [
      { token: 'WIF',  amount: '340 SOL', minutesBefore: 1 },
      { token: 'MYRO', amount: '180 SOL', minutesBefore: 2 },
      { token: 'BONK', amount: '260 SOL', minutesBefore: 3 },
    ]
  },
  {
    address: 'KX2m…2eNs', label: 'Market Maker',
    pnl: '+$67K', pnlRaw: 67000, trades: 3201, winRate: 65,
    isInsider: false, insiderScore: 31,
    lastAction: 'BUY', lastToken: 'MYRO', lastTime: '8m ago',
    tags: ['MM', 'LIQUIDITY'],
    recentBuys: []
  },
]

function InsiderBadge({ score }: { score: number }) {
  if (score >= 85) return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.2))',
      border: '1px solid rgba(245,158,11,0.4)',
      borderRadius: '4px', padding: '2px 6px',
      fontSize: '8px', fontWeight: 700, letterSpacing: '0.06em',
      color: '#fbbf24', fontFamily: 'IBM Plex Mono, monospace',
    }}>
      ◆ ELITE INSIDER
    </span>
  )
  if (score >= 70) return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      background: 'rgba(167,139,250,0.15)',
      border: '1px solid rgba(167,139,250,0.3)',
      borderRadius: '4px', padding: '2px 6px',
      fontSize: '8px', fontWeight: 700,
      color: '#a78bfa', fontFamily: 'IBM Plex Mono, monospace',
    }}>
      ◈ INSIDER
    </span>
  )
  return null
}

function InsiderScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? '#fbbf24' : score >= 70 ? '#a78bfa' : score >= 50 ? '#38bdf8' : '#6b7280'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: '9px', color, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', width: '24px' }}>{score}</span>
    </div>
  )
}

export default function InsiderWhaleIntel() {
  const [selected, setSelected] = useState<WhaleWallet | null>(null)
  const [filter, setFilter] = useState<'all' | 'insider' | 'whale'>('all')
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 1500)
    return () => clearInterval(iv)
  }, [])

  const filtered = INSIDER_WALLETS.filter(w => {
    if (filter === 'insider') return w.isInsider
    if (filter === 'whale') return w.pnlRaw > 100000
    return true
  })

  return (
    <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#e6edf3' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%', background: '#fbbf24',
            boxShadow: pulse ? '0 0 10px #fbbf24' : '0 0 4px #fbbf24',
            transition: 'box-shadow 0.5s',
          }} />
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#fbbf24' }}>
            INSIDER WHALE INTELLIGENCE
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all','insider','whale'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '3px 10px', borderRadius: '4px', fontSize: '8px', fontWeight: 700,
              letterSpacing: '0.05em', cursor: 'pointer', border: 'none',
              fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase',
              background: filter === f ? 'rgba(251,191,36,0.15)' : 'transparent',
              color: filter === f ? '#fbbf24' : 'rgba(255,255,255,0.3)',
              borderWidth: '1px', borderStyle: 'solid',
              borderColor: filter === f ? 'rgba(251,191,36,0.3)' : 'transparent',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Wallet cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {filtered.map(wallet => (
          <div
            key={wallet.address}
            onClick={() => setSelected(selected?.address === wallet.address ? null : wallet)}
            style={{
              background: wallet.isInsider
                ? 'linear-gradient(135deg, rgba(251,191,36,0.04) 0%, rgba(8,8,24,0.95) 100%)'
                : 'rgba(255,255,255,0.02)',
              border: wallet.isInsider
                ? '1px solid rgba(251,191,36,0.15)'
                : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              padding: '10px 14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                background: wallet.isInsider ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', flexShrink: 0,
              }}>
                {wallet.insiderScore >= 85 ? '◆' : wallet.insiderScore >= 70 ? '◈' : '○'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#e6edf3' }}>{wallet.label}</span>
                  <InsiderBadge score={wallet.insiderScore} />
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{wallet.address}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e' }}>{wallet.pnl}</div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>{wallet.winRate}% win</div>
              </div>
            </div>

            {/* Insider score bar */}
            {wallet.isInsider && (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>INSIDER SCORE</div>
                <InsiderScoreBar score={wallet.insiderScore} />
              </div>
            )}

            {/* Tags + last action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {wallet.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: '8px', padding: '1px 5px', borderRadius: '3px',
                  background: tag === 'INSIDER' ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.06)',
                  color: tag === 'INSIDER' ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                  border: tag === 'INSIDER' ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(255,255,255,0.08)',
                }}>{tag}</span>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: '9px' }}>
                <span style={{ color: wallet.lastAction === 'BUY' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                  {wallet.lastAction}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}> {wallet.lastToken} · {wallet.lastTime}</span>
              </span>
            </div>

            {/* Expanded — recent insider buys */}
            {selected?.address === wallet.address && wallet.recentBuys.length > 0 && (
              <div style={{
                marginTop: '10px', paddingTop: '10px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginBottom: '6px', letterSpacing: '0.08em' }}>
                  INSIDER ENTRIES — BOUGHT BEFORE ALPHA ALERT
                </div>
                {wallet.recentBuys.map((buy, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '4px 8px', marginBottom: '3px',
                    background: 'rgba(34,197,94,0.04)',
                    border: '1px solid rgba(34,197,94,0.1)',
                    borderRadius: '4px', fontSize: '9px',
                  }}>
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>◆</span>
                    <span style={{ color: '#e6edf3', fontWeight: 600 }}>${buy.token}</span>
                    <span style={{ color: '#22c55e' }}>{buy.amount}</span>
                    <span style={{ marginLeft: 'auto', color: '#f59e0b', fontWeight: 700 }}>
                      {buy.minutesBefore}min before alert
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Live activity feed */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px', padding: '12px',
      }}>
        <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '8px' }}>
          RECENT SMART MONEY ACTIVITY
        </div>
        {[
          { action: 'BUY',  wallet: '7xKP…8gQw', token: 'BONK',   amount: '180 SOL', time: '2m ago',  color: '#22c55e', insider: true  },
          { action: 'SELL', wallet: 'BotA…3kRf', token: 'WIF',    amount: '340 SOL', time: '3m ago',  color: '#ef4444', insider: true  },
          { action: 'BUY',  wallet: '3nRT…4mPL', token: 'POPCAT', amount: '75 SOL',  time: '5m ago',  color: '#22c55e', insider: true  },
          { action: 'BUY',  wallet: '7xKP…8gQw', token: 'MEW',    amount: '220 SOL', time: '8m ago',  color: '#22c55e', insider: true  },
          { action: 'SELL', wallet: 'DeFi…9hWs', token: 'BOME',   amount: '95 SOL',  time: '12m ago', color: '#ef4444', insider: false },
        ].map((activity, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '5px 0',
            borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            fontSize: '10px',
          }}>
            <span style={{
              color: activity.color, fontWeight: 700,
              background: `${activity.color}15`, padding: '1px 6px',
              borderRadius: '3px', fontSize: '8px', width: '32px', textAlign: 'center',
            }}>{activity.action}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{activity.wallet}</span>
            <span style={{ color: '#e6edf3', fontWeight: 600 }}>${activity.token}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>—</span>
            <span style={{ color: '#a78bfa' }}>{activity.amount}</span>
            {activity.insider && (
              <span style={{ fontSize: '8px', color: '#fbbf24' }}>◆</span>
            )}
            <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}>{activity.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
