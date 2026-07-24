'use client'

import { useEffect, useState } from 'react'
import { Crosshair, Newspaper, Send, Sparkles, TrendingUp, Wallet, Waves } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { useHoldings } from '../hooks/useHoldings'

type Msg = { role: 'user' | 'assistant'; text: string }

const QUICK = [
  { label: 'Analyze top holding', sub: 'Get AI insights and risk analysis', icon: Sparkles },
  { label: 'Analyze Token', sub: 'Paste a mint in chat or analyze your top holding', icon: Crosshair },
  { label: 'Smart Money', sub: 'Where is smart-money flow strongest right now?', icon: Waves },
  { label: "What's trending today?", sub: 'See top narratives and tokens', icon: TrendingUp },
  { label: 'Review my portfolio', sub: 'AI-powered portfolio review', icon: Wallet },
  { label: 'Market outlook', sub: 'Get AI market predictions', icon: Newspaper },
] as const

function greet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function CoachPanel() {
  const { walletAddress, shortAddr, isConnected, connect } = useSolana()
  const { data } = useHoldings()
  const top = data?.holdings[0]
  const [draft, setDraft] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [streaming, setStreaming] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/portfolio/coach', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { available?: boolean }) => {
        if (!cancelled) setOnline(Boolean(body.available))
      })
      .catch(() => {
        if (!cancelled) setOnline(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const run = async (prompt: string) => {
    const text = prompt.trim()
    if (!text || streaming) return
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }])
    setDraft('')
    setStreaming(true)
    try {
      const res = await fetch('/api/portfolio/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, walletAddress: walletAddress ?? undefined }),
      })
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        if (res.status === 503) setOnline(false)
        setMsgs((m) => {
          const next = [...m]
          next[next.length - 1] = {
            role: 'assistant',
            text: err.error || 'Coach unavailable. Check ANTHROPIC_API_KEY on the server.',
          }
          return next
        })
        return
      }
      setOnline(true)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        const snapshot = acc
        setMsgs((m) => {
          const next = [...m]
          next[next.length - 1] = { role: 'assistant', text: snapshot }
          return next
        })
      }
    } catch {
      setMsgs((m) => {
        const next = [...m]
        next[next.length - 1] = { role: 'assistant', text: 'Network error talking to coach.' }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  const name = isConnected && shortAddr ? shortAddr : 'trader'
  const statusColor = online === false ? 'var(--pd-text-faint)' : 'var(--pd-positive)'
  const statusLabel = online === false ? 'Offline' : online === null ? '…' : 'Online'

  return (
    <section style={{ marginTop: 16 }}>
      <div className="pd-panel-head" style={{ padding: '0 4px 0', border: 'none' }}>
        <h2>AI Coach</h2>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: statusColor }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor,
              boxShadow: online ? '0 0 0 3px var(--pd-positive-soft)' : undefined,
            }}
          />
          {statusLabel}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 2px' }}>
        {greet()}, {name}
      </div>
      <div style={{ fontSize: 12, color: 'var(--pd-text-faint)', marginBottom: 14 }}>
        How can I help you today?
      </div>

      {QUICK.map((q) => {
        const Icon = q.icon
        const title =
          q.label === 'Analyze top holding' && top
            ? `Analyze ${top.symbol}`
            : q.label === 'Analyze Token' && top
              ? `Analyze Token · ${top.symbol}`
              : q.label
        const prompt =
          q.label === 'Analyze top holding' && top
            ? `Analyze ${top.symbol} in my portfolio`
            : q.label === 'Analyze Token' && top
              ? `Analyze token ${top.mint} (${top.symbol}) using live market scores`
              : q.label === 'Analyze Token'
                ? 'Analyze a Solana token — ask me for a mint address if needed'
                : q.label === 'Smart Money'
                  ? 'Where is smart money flowing among trending Solana tokens right now?'
                  : q.label
        return (
          <button
            key={q.label}
            type="button"
            className="pd-coach-action"
            disabled={streaming || online === false}
            onClick={() => void run(prompt)}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--pd-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--pd-accent)',
                flexShrink: 0,
              }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>{q.sub}</div>
            </div>
          </button>
        )
      })}

      {msgs.length ? (
        <div className="pd-chat">
          {msgs.map((m, i) => (
            <div key={i} className={`pd-chat-msg${m.role === 'user' ? ' user' : ''}`}>
              {m.text || (streaming && i === msgs.length - 1 ? '…' : '')}
            </div>
          ))}
        </div>
      ) : null}

      {!isConnected ? (
        <button
          type="button"
          className="pd-connect"
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => void connect()}
        >
          Connect Wallet for portfolio-aware answers
        </button>
      ) : null}

      <form
        className="pd-ask-box"
        onSubmit={(e) => {
          e.preventDefault()
          void run(draft)
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask me anything…"
          aria-label="Ask AI Coach"
          disabled={streaming || online === false}
        />
        <button
          type="submit"
          className="pd-ask-send"
          disabled={streaming || online === false || !draft.trim()}
          aria-label="Send"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </form>
      <div className="pd-ask-note">AI responses are not financial advice.</div>
    </section>
  )
}
