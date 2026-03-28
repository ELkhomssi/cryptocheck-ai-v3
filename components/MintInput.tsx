'use client'
import { useRef } from 'react'

export default function MintInput({ onScan, loading }: { 
  onScan: (mint: string) => void
  loading: boolean 
}) {
  const ref = useRef<HTMLInputElement>(null)
  
  const handle = () => {
    const v = ref.current?.value?.trim() || ''
    if (v.length >= 20) onScan(v)
  }

  return (
    <div className="p-3.5 border-b border-[rgba(99,102,241,0.14)]">
      <div className="panel-label">Neural Scan</div>
      <input
        ref={ref}
        placeholder="Enter mint address…"
        onKeyDown={e => e.key === 'Enter' && handle()}
        className="w-full bg-[#111120] border border-[rgba(99,102,241,0.16)] rounded-[4px] px-2.5 py-2 font-mono text-[0.65rem] text-[#c9d1d9] outline-none transition-all focus:border-indigo-500 placeholder:text-[#374151] mb-2"
        autoComplete="off"
        spellCheck={false}
        style={{ caretColor: '#a78bfa' }}
      />
      <button
        onClick={handle}
        disabled={loading}
        className="w-full py-2 rounded-[4px] font-mono text-[0.65rem] font-bold tracking-wider text-white flex items-center justify-center gap-1.5 disabled:opacity-40 transition-all"
        style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 0 14px rgba(99,102,241,0.3)' }}
      >
        <span>{loading ? '⟳' : '⚡'}</span>
        <span>{loading ? 'SCANNING…' : 'NEURAL SCAN'}</span>
      </button>
    </div>
  )
}
