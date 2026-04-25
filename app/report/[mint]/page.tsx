'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { safetyScoreToEliteGrade, type EliteGrade } from '@/lib/elite-grade'

type BriefingPayload = {
  mint: string
  name?: string
  sym?: string
  safetyScore: number
  elite?: EliteGrade
  verdict?: string
  timestamp?: number
}

export default function EliteReportPage() {
  const params = useParams()
  const mint = params.mint as string
  const [data, setData] = useState<BriefingPayload | null>(undefined)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`cc_elite_report_${mint}`)
      if (raw) setData(JSON.parse(raw) as BriefingPayload)
      else setData(null)
    } catch {
      setData(null)
    }
  }, [mint])

  if (data === undefined) {
    return (
      <div className="min-h-screen bg-[#030308] flex items-center justify-center font-mono text-[#8b949e] text-[0.75rem]">
        Loading briefing…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#030308] text-[#e2e8f0] p-8 font-mono">
        <p className="text-[0.8rem] text-[#8b949e] max-w-md leading-relaxed">
          No intelligence briefing on file for this mint. Run a neural scan from the terminal, then open this page again.
        </p>
        <Link href="/app" className="inline-block mt-6 text-[0.7rem] font-bold tracking-wider uppercase text-[#c8ff00] border border-[#c8ff00]/35 rounded px-3 py-2 hover:bg-[#c8ff00]/10">
          ← Return to Scanner
        </Link>
      </div>
    )
  }

  const eg = data.elite ?? safetyScoreToEliteGrade(data.safetyScore ?? 0)
  const lime = '#c8ff00'
  const blood = '#ff5722'
  const tierColor = eg.accent === 'safe' ? lime : eg.accent === 'mid' ? '#f59e0b' : blood
  const showCert = eg.tier === 'S'

  return (
    <div className="min-h-screen bg-[#030308] text-[#c9d1d9] p-6 md:p-12 font-mono selection:bg-[#c8ff00]/25">
      <div className="max-w-3xl mx-auto border border-white/[0.07] bg-[#050508]/80 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.65)]">
        <header className="px-6 py-5 border-b border-white/[0.08] bg-[#020204]/90">
          <div className="text-[0.55rem] tracking-[0.28em] text-[#c8ff00] uppercase mb-2">Classified // Solana Intelligence Briefing</div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-[#e8eaed] tracking-tight">
                {data.name ?? 'Unknown Asset'}{' '}
                <span className="text-[#6b7a90] font-normal">({data.sym ?? '???'})</span>
              </h1>
              <div className="text-[0.62rem] text-[#6b7a90] mt-2 break-all">{data.mint}</div>
            </div>
            <div className="text-right">
              <div className="text-[2.2rem] font-black leading-none" style={{ color: tierColor }}>
                {eg.tier}
              </div>
              <div className="text-[0.58rem] font-bold uppercase tracking-widest mt-1" style={{ color: tierColor }}>
                {eg.tier === 'S' ? 'Iron Dome Certified' : eg.label}
              </div>
              <div className="text-[0.55rem] text-[#8b949e] mt-1">Safety index {data.safetyScore ?? '—'}/100</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              type="button"
              onClick={() => {
                window.alert('Professional PDF export will be available in a future institutional build.')
              }}
              className="text-[0.58rem] font-bold tracking-wider uppercase px-3 py-2 rounded border border-white/20 text-[#e8eaed] hover:bg-white/[0.06] transition-colors"
            >
              Professional PDF Export
            </button>
            <Link
              href="/app"
              className="text-[0.58rem] font-bold tracking-wider uppercase px-3 py-2 rounded border border-[#c8ff00]/35 text-[#c8ff00] hover:bg-[#c8ff00]/10 transition-colors"
            >
              ← Terminal
            </Link>
          </div>
        </header>

        <section className="px-6 py-5 space-y-4 text-[0.72rem] leading-relaxed text-[#b8c5d4] border-b border-white/[0.06]">
          <h2 className="text-[0.55rem] font-bold tracking-[0.2em] text-[#8b949e] uppercase">Executive summary</h2>
          <p>
            Attack Surface review under Zero-Day Heuristics indicates protocol posture tier <strong style={{ color: tierColor }}>{eg.tier}</strong>.{' '}
            {eg.certificationLine} {data.verdict ? `Neural verdict snapshot: ${data.verdict}` : ''}
          </p>
          <p className="text-[0.65rem] text-[#6b7a90]">
            Malicious Payload Detection and Protocol Integrity checks are advisory; on-chain conditions may change after this briefing timestamp.
          </p>
        </section>

        {showCert && (
          <section className="px-6 py-8 bg-gradient-to-b from-[#c8ff00]/[0.06] to-transparent border-b border-[#c8ff00]/15">
            <div className="text-[0.5rem] tracking-[0.35em] text-[#c8ff00] uppercase text-center mb-3">Certificate of Neutralization</div>
            <div className="max-w-md mx-auto border-2 border-[#c8ff00]/40 rounded-lg p-6 text-center bg-[#030308]/90">
              <div className="text-2xl font-black text-[#c8ff00] mb-2">IRON DOME CERTIFIED</div>
              <div className="text-[0.68rem] text-[#e8eaed] leading-relaxed">
                This token cleared the CryptoCheck AI Sovereign Security Auditor within the S-tier band for the scanned snapshot.
              </div>
              <div className="mt-4 pt-4 border-t border-[#c8ff00]/20 text-[0.58rem] text-[#8b949e] break-all">{data.mint}</div>
              <button
                type="button"
                onClick={() => {
                  const line = encodeURIComponent(
                    `Iron Dome Certified by CryptoCheck AI — ${data.sym ?? 'token'} · S-tier security briefing. ${typeof window !== 'undefined' ? window.location.href : ''}`
                  )
                  window.open(`https://twitter.com/intent/tweet?text=${line}`, '_blank')
                }}
                className="mt-4 w-full py-2 rounded text-[0.58rem] font-bold uppercase tracking-wider bg-[#c8ff00]/15 text-[#c8ff00] border border-[#c8ff00]/40 hover:bg-[#c8ff00]/25"
              >
                Share on X
              </button>
            </div>
          </section>
        )}

        <footer className="px-6 py-4 text-[0.55rem] text-[#4b5563]">
          CryptoCheck AI · Offensive Sovereign Engine · For informational purposes only · Not financial advice
        </footer>
      </div>
    </div>
  )
}
