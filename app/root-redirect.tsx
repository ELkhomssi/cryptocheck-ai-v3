'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import LandingPage from './landing/page'
import Dashboard from './dashboard/page'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function RootPage() {
  const [user, setUser] = useState<any>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Loading
  if (user === undefined) return (
    <div style={{background:'#050a06',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <div style={{width:32,height:32,background:'linear-gradient(135deg,#34d399,#10b981)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#050a06'}}>CC</div>
        <div style={{fontSize:11,color:'#34d399',fontFamily:'IBM Plex Mono,monospace',animation:'pulse 1.5s infinite'}}>LOADING...</div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )

  // Not logged in → landing
  if (!user) return <LandingPage />

  // Logged in → dashboard (redirect to /app)
  if (typeof window !== 'undefined') window.location.replace('/app')
  return null
}
