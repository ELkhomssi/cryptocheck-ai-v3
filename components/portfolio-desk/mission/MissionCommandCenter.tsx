'use client'

/**
 * Phase 17.1 — Command Center (mission OS).
 * Streams via existing POST /api/portfolio/coach — no new APIs.
 */

import { useEffect, useRef, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'

const EXAMPLES = [
  'Find the safest launch today',
  'Why did my risk increase?',
  'Audit this token',
  'Track this wallet forever',
  'Compare BONK vs WIF',
  'Show hidden whale accumulation',
]

type Msg = { role: 'user' | 'assistant'; text: string }

export function MissionCommandCenter({
  seedPrompt,
  onSeedConsumed,
}: {
  seedPrompt?: string | null
  onSeedConsumed?: () => void
}) {
  const { walletAddress } = useSolana()
  const [draft, setDraft] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [streaming, setStreaming] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)
  const [thinking, setThinking] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, thinking])

  useEffect(() => {
    if (seedPrompt?.trim()) {
      void run(seedPrompt.trim())
      onSeedConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt])

  const run = async (prompt: string) => {
    const text = prompt.trim()
    if (!text || streaming) return
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }])
    setDraft('')
    setStreaming(true)
    setThinking('Interpreting your request…')
    try {
      const res = await fetch('/api/portfolio/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, walletAddress: walletAddress ?? undefined }),
      })
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        if (res.status === 503) setOnline(false)
        setThinking(null)
        setMsgs((m) => {
          const next = [...m]
          next[next.length - 1] = {
            role: 'assistant',
            text: err.error || 'Command Center unavailable. OPENAI_API_KEY may be missing on the server.',
          }
          return next
        })
        return
      }
      setOnline(true)
      setThinking('Building a grounded reply…')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        if (acc.length > 0) setThinking(null)
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
        next[next.length - 1] = {
          role: 'assistant',
          text: 'Network error talking to Command Center.',
        }
        return next
      })
    } finally {
      setStreaming(false)
      setThinking(null)
    }
  }

  return (
    <section className="mc-command">
      <div className="mc-command-head">
        <div>
          <div className="mc-kicker">Command Center</div>
          <h2 className="mc-command-title">What should we do next?</h2>
        </div>
        <span
          className="mc-status-dot"
          style={{
            color:
              online === false
                ? 'var(--pd-text-faint)'
                : online
                  ? 'var(--pd-positive)'
                  : 'var(--pd-text-dim)',
          }}
        >
          {online === false ? 'Offline' : online === null ? 'Connecting…' : 'Live'}
        </span>
      </div>

      <div className="mc-command-stream">
        {msgs.length === 0 && !streaming ? (
          <p className="mc-command-idle">
            Ask me anything about markets, risk, launches, or your portfolio. Replies are grounded
            in live context — nothing invented.
          </p>
        ) : null}
        {msgs.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={m.role === 'user' ? 'mc-msg mc-msg-user' : 'mc-msg mc-msg-ai'}
          >
            <div className="mc-msg-role">{m.role === 'user' ? 'You' : 'Mission Control'}</div>
            <div className="mc-msg-body">{m.text || (streaming && i === msgs.length - 1 ? '…' : '')}</div>
          </div>
        ))}
        {thinking ? <div className="mc-thinking">{thinking}</div> : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="mc-command-form"
        onSubmit={(e) => {
          e.preventDefault()
          void run(draft)
        }}
      >
        <input
          className="mc-command-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask me anything…"
          disabled={streaming || online === false}
          aria-label="Command Center prompt"
        />
        <button
          type="submit"
          className="mc-command-send"
          disabled={streaming || !draft.trim() || online === false}
        >
          {streaming ? 'Thinking' : 'Send'}
        </button>
      </form>

      <div className="mc-examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="mc-example"
            disabled={streaming || online === false}
            onClick={() => void run(ex)}
          >
            {ex}
          </button>
        ))}
      </div>
    </section>
  )
}
