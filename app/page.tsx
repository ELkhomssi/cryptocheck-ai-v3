'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import LandingPage from './landing/page'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function RootPage() {
  const [status, setStatus] = useState<'loading'|'guest'|'user'>('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) window.location.replace('/app')
      else setStatus('guest')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) window.location.replace('/app')
      else setStatus('guest')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading') return (
    <div style={{background:'#050a06',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:36,height:36,background:'linear-gradient(135deg,#34d399,#10b981)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#050a06',margin:'0 auto 12px'}}>CC</div>
        <div style={{fontSize:11,color:'#34d399',fontFamily:'IBM Plex Mono,monospace',letterSpacing:'0.1em'}}>LOADING...</div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )

  return <LandingPage />
}
