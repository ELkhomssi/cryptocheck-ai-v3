'use client'

/**
 * Command Center — heart of Mission Control.
 * Streams via existing POST /api/portfolio/coach. Suggestions are dynamic.
 */

import { useEffect, useRef, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'

type Msg = { role: 'user' | 'assistant'; text: string }

export function MissionCommandCenter({
  seedPrompt,
  onSeedConsumed,
  suggestions = [],
  onPickSuggestion,
}: {
  seedPrompt?: string | null
  onSeedConsumed?: () => void
  suggestions?: string[]
  onPickSuggestion?: (text: string) => void
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
    setThinking('Thinking…')
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
            text: err.error || 'I’m offline — OPENAI_API_KEY may be missing on the server.',
          }
          return next
        })
        return
      }
      setOnline(true)
      setThinking('Writing…')
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
          text: 'Network error — I couldn’t reach the coach.',
        }
        return next
      })
    } finally {
      setStreaming(false)
      setThinking(null)
    }
  }

  return (
    <section className="mc-listen">
      {msgs.length > 0 ? (
        <div className="mc-listen-stream">
          {msgs.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={m.role === 'user' ? 'mc-listen-user' : 'mc-listen-ai'}
            >
              {m.text || (streaming && i === msgs.length - 1 ? '…' : '')}
            </div>
          ))}
          {thinking ? <div className="mc-thinking">{thinking}</div> : null}
          <div ref={bottomRef} />
        </div>
      ) : null}

      <form
        className="mc-listen-form"
        onSubmit={(e) => {
          e.preventDefault()
          void run(draft)
        }}
      >
        <input
          className="mc-listen-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message Mission Control…"
          disabled={streaming || online === false}
          aria-label="Talk to Mission Control"
        />
        <button
          type="submit"
          className="mc-listen-send"
          disabled={streaming || !draft.trim() || online === false}
        >
          {streaming ? '…' : 'Send'}
        </button>
      </form>

      {suggestions.length > 0 ? (
        <div className="mc-listen-suggestions">
          {suggestions.map((ex) => (
            <button
              key={ex}
              type="button"
              className="mc-listen-chip"
              disabled={streaming || online === false}
              onClick={() => {
                if (onPickSuggestion) onPickSuggestion(ex)
                else void run(ex)
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      {online === false ? (
        <p className="mc-listen-offline">Command Center offline — coach key not configured.</p>
      ) : null}
    </section>
  )
}
