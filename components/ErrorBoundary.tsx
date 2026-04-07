'use client'
import React from 'react'

interface State { hasError: boolean; error: string }

export default class ErrorBoundary extends React.Component<{children: React.ReactNode; name?: string}, State> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) return (
      <div style={{padding:24,fontFamily:'IBM Plex Mono,monospace',color:'#f87171',background:'rgba(248,113,113,0.04)',border:'1px solid rgba(248,113,113,0.15)',borderRadius:8,margin:12}}>
        <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>⚠ {this.props.name || 'Component'} Error</div>
        <div style={{fontSize:10,color:'rgba(248,113,113,0.7)',marginBottom:12}}>{this.state.error}</div>
        <button onClick={()=>this.setState({hasError:false,error:''})} style={{padding:'6px 14px',background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:5,color:'#f87171',fontSize:10,cursor:'pointer',fontFamily:'IBM Plex Mono,monospace'}}>
          ↺ Retry
        </button>
      </div>
    )
    return this.props.children
  }
}
