'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ErrorBoundary from '@/components/ErrorBoundary'
import Dashboard from '../dashboard'

export default function AppPage() {
  const [status, setStatus] = useState<'loading'|'ready'>('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Always show dashboard — trial users + logged in users
      setStatus('ready')
    })
  }, [])

  if (status === 'loading') return (
    <div style={{background:'#000',height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,fontFamily:"'JetBrains Mono',monospace"}}>
      <div style={{width:26,height:26,border:'2px solid rgba(52,211,153,0.15)',borderTop:'2px solid #34d399',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
      <div style={{fontSize:10,color:'rgba(52,211,153,0.5)',letterSpacing:'0.1em'}}>LOADING</div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  return (
    <ErrorBoundary name="Dashboard">
      <Dashboard />
    </ErrorBoundary>
  )
}
