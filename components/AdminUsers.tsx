'use client'
import { useEffect, useState } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

interface Profile {
  email: string
  is_confirmed: boolean
  referral_source: string
  trial_started_at: string
  is_pro: boolean
  created_at: string
}

export default function AdminUsers() {
  const [users, setUsers]   = useState<Profile[]>([])
  const [stats, setStats]   = useState({ total: 0, confirmed: 0, pro: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setLoading(false)
        return
      }
      const { data } = await getSupabase()
        .from('profiles')
        .select('email, confirmed_at, referral_source, trial_started_at, is_pro, created_at')
        .order('created_at', { ascending: false })
        .limit(30)

      if (data) {
        const mapped = data.map(u => ({
          email:            u.email,
          is_confirmed:     !!u.confirmed_at,
          referral_source:  u.referral_source || 'direct',
          trial_started_at: u.trial_started_at,
          is_pro:           u.is_pro,
          created_at:       u.created_at,
        }))
        setUsers(mapped)
        setStats({
          total:     data.length,
          confirmed: data.filter(u => u.confirmed_at).length,
          pro:       data.filter(u => u.is_pro).length,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ color:'#00d4aa', padding:20, fontFamily:'IBM Plex Mono,monospace' }}>Loading...</div>

  return (
    <div style={{ fontFamily:'IBM Plex Mono,monospace', color:'#e2e8f0', padding:20, background:'#0e1117', minHeight:'100vh' }}>
      <h1 style={{ fontSize:18, fontWeight:700, marginBottom:16, color:'#00d4aa' }}>Admin — User Verification</h1>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Users',      val:stats.total,     color:'#e2e8f0' },
          { label:'Confirmed (Real)', val:stats.confirmed, color:'#00d4aa' },
          { label:'Pro Users',        val:stats.pro,       color:'#f0a500' },
        ].map(s => (
          <div key={s.label} style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'12px 16px' }}>
            <div style={{ fontSize:10, color:'#6e7681', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:'#0d1117', borderBottom:'1px solid #21262d' }}>
              {['Email','Confirmed','Referral Source','Trial Start','Pro','Joined'].map(h => (
                <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:9, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#6e7681' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} style={{ borderBottom:'1px solid #161b22' }}>
                <td style={{ padding:'9px 14px', color:'#e2e8f0' }}>{u.email}</td>
                <td style={{ padding:'9px 14px' }}>
                  <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700, background:u.is_confirmed?'rgba(0,212,130,0.12)':'rgba(255,68,68,0.12)', color:u.is_confirmed?'#00d4aa':'#ff4444', border:`1px solid ${u.is_confirmed?'rgba(0,212,130,0.25)':'rgba(255,68,68,0.25)'}` }}>
                    {u.is_confirmed ? '✓ YES' : '✗ NO'}
                  </span>
                </td>
                <td style={{ padding:'9px 14px' }}>
                  <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700, background:'rgba(88,166,255,0.1)', color:'#58a6ff', border:'1px solid rgba(88,166,255,0.2)' }}>
                    {u.referral_source}
                  </span>
                </td>
                <td style={{ padding:'9px 14px', color:'#8b949e', fontSize:10 }}>{u.trial_started_at ? new Date(u.trial_started_at).toLocaleDateString() : '—'}</td>
                <td style={{ padding:'9px 14px', color:u.is_pro?'#f0a500':'#484f58', fontWeight:700 }}>{u.is_pro ? '⭐ PRO' : 'FREE'}</td>
                <td style={{ padding:'9px 14px', color:'#6e7681', fontSize:10 }}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
